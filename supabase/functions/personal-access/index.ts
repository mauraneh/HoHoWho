// Supabase Edge Function: password-less, e-mail-less accounts based on personal links.
//
// Every person gets a private "personal link" (#/k/<key>) that signs them in on any device.
// The key holds a random account id and a random secret; the account is a regular Supabase
// Auth user with a synthetic e-mail address (never used to send anything) and the secret as its
// password, so sign-in itself is a standard signInWithPassword call from the browser.
//
// Actions (POST JSON):
//  - { action: 'join', name, invitation }   → new participant account; requires a valid,
//                                             unexpired invitation of an open event
//  - { action: 'organizer', name, code }    → new organiser account; requires ORGANIZER_CODE
//  - { action: 'reset', participantId? }    → new link for the caller, or (organiser of the
//                                             participant's event) for that participant
// Responses: { key } where key = "<account>.<secret>".
import { createClient } from 'npm:@supabase/supabase-js@2.117.3';

const GUEST_DOMAIN = 'guest.hohowho.app';
const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? '*')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

function corsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get('Origin') ?? '';
  const allowOrigin = ALLOWED_ORIGINS.includes('*')
    ? '*'
    : ALLOWED_ORIGINS.includes(origin)
      ? origin
      : (ALLOWED_ORIGINS[0] ?? '');
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

function json(request: Request, status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(request), 'Content-Type': 'application/json' },
  });
}

function randomHex(bytes: number): string {
  const buffer = new Uint8Array(bytes);
  crypto.getRandomValues(buffer);
  return Array.from(buffer, (b) => b.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Constant-time comparison of two strings (hashes them first so lengths match). */
async function safeEqual(a: string, b: string): Promise<boolean> {
  const [ha, hb] = await Promise.all([sha256Hex(a), sha256Hex(b)]);
  let diff = 0;
  for (let i = 0; i < ha.length; i++) diff |= ha.charCodeAt(i) ^ hb.charCodeAt(i);
  return diff === 0;
}

function cleanName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const name = value.trim().replace(/\s+/g, ' ');
  return name.length >= 1 && name.length <= 60 ? name : null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(request) });
  if (request.method !== 'POST') return json(request, 405, { error: 'Method not allowed' });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return json(request, 500, { error: 'Function is not configured' });
  }
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json(request, 400, { error: 'Invalid JSON body' });
  }

  /** Creates a guest account and returns its personal key. */
  const createAccount = async (name: string): Promise<{ key: string; email: string } | null> => {
    const account = `g${randomHex(8)}`;
    const secret = randomHex(24);
    const email = `${account}@${GUEST_DOMAIN}`;
    const { error } = await admin.auth.admin.createUser({
      email,
      password: secret,
      email_confirm: true,
      user_metadata: { display_name: name },
    });
    if (error) {
      console.error('createUser failed', error);
      return null;
    }
    return { key: `${account}.${secret}`, email };
  };

  switch (body['action']) {
    case 'join': {
      const name = cleanName(body['name']);
      const invitation = body['invitation'];
      if (!name) return json(request, 400, { error: 'Please enter your first name' });
      if (typeof invitation !== 'string' || !/^[0-9a-f]{64}$/i.test(invitation)) {
        return json(request, 404, { error: 'This invitation is invalid or has expired' });
      }
      // Only someone holding a valid invitation of an open event may create an account.
      const { data: found, error } = await admin
        .from('invitations')
        .select('id, expires_at, events!inner(status)')
        .eq('token_hash', `\\x${await sha256Hex(invitation)}`)
        .gt('expires_at', new Date().toISOString())
        .eq('events.status', 'open')
        .maybeSingle();
      if (error) {
        console.error('Invitation lookup failed', error);
        return json(request, 500, { error: 'Could not check the invitation' });
      }
      if (!found) return json(request, 404, { error: 'This invitation is invalid or has expired' });
      const created = await createAccount(name);
      return created
        ? json(request, 200, { key: created.key })
        : json(request, 500, { error: 'Could not create the account' });
    }

    case 'organizer': {
      const name = cleanName(body['name']);
      const expected = Deno.env.get('ORGANIZER_CODE');
      if (!expected) return json(request, 503, { error: 'Organiser code is not configured' });
      if (!name) return json(request, 400, { error: 'Please enter your first name' });
      if (typeof body['code'] !== 'string' || !(await safeEqual(body['code'].trim(), expected))) {
        return json(request, 403, { error: 'Wrong organiser code' });
      }
      const created = await createAccount(name);
      if (!created) return json(request, 500, { error: 'Could not create the account' });
      const { error } = await admin.from('organizers').insert({ email: created.email });
      if (error) {
        console.error('Could not register organiser', error);
        return json(request, 500, { error: 'Could not create the account' });
      }
      return json(request, 200, { key: created.key });
    }

    case 'reset': {
      const authorization = request.headers.get('Authorization') ?? '';
      const { data: caller } = await admin.auth.getUser(authorization.replace(/^Bearer /, ''));
      if (!caller?.user) return json(request, 401, { error: 'Sign in required' });

      let targetId = caller.user.id;
      const participantId = body['participantId'];
      if (participantId !== undefined) {
        if (typeof participantId !== 'string' || !UUID.test(participantId)) {
          return json(request, 400, { error: 'Unknown participant' });
        }
        const { data: participant } = await admin
          .from('participants')
          .select('user_id, events!inner(owner_id)')
          .eq('id', participantId)
          .maybeSingle();
        const ownerId = (participant?.events as unknown as { owner_id: string } | null)?.owner_id;
        if (!participant || ownerId !== caller.user.id) {
          return json(request, 403, { error: 'Only the organiser can do this' });
        }
        targetId = participant.user_id as string;
      }

      const { data: target } = await admin.auth.admin.getUserById(targetId);
      const email = target?.user?.email ?? '';
      if (!email.endsWith(`@${GUEST_DOMAIN}`)) {
        return json(request, 409, { error: 'This account does not use a personal link' });
      }
      const secret = randomHex(24);
      const { error } = await admin.auth.admin.updateUserById(targetId, { password: secret });
      if (error) {
        console.error('Password reset failed', error);
        return json(request, 500, { error: 'Could not create a new link' });
      }
      return json(request, 200, { key: `${email.split('@')[0]}.${secret}` });
    }

    default:
      return json(request, 400, { error: 'Unknown action' });
  }
});
