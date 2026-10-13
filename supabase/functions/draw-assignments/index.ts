// Supabase Edge Function: draws Secret Santa assignments for an event.
//
// Only the event organiser may call it. The draw is computed here with a CSPRNG and persisted
// atomically through public.apply_draw(), which is executable by the service role only and
// re-validates every pair (completeness, no self-draw, exclusions, event still open).
import { createClient } from 'npm:@supabase/supabase-js@2.117.3';
import { DrawImpossibleError, drawAssignments, MIN_PARTICIPANTS } from '../_shared/draw.ts';

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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(request) });
  }
  if (request.method !== 'POST') {
    return json(request, 405, { error: 'Method not allowed' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json(request, 500, { error: 'Function is not configured' });
  }

  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return json(request, 401, { error: 'Sign in required' });
  }

  let eventId: unknown;
  try {
    ({ eventId } = await request.json());
  } catch {
    return json(request, 400, { error: 'Invalid JSON body' });
  }
  if (typeof eventId !== 'string' || !UUID.test(eventId)) {
    return json(request, 400, { error: 'eventId must be a UUID' });
  }

  // Identify the caller from their JWT.
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser(
    authorization.slice('Bearer '.length),
  );
  if (userError || !userData.user) {
    return json(request, 401, { error: 'Sign in required' });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: event, error: eventError } = await admin
    .from('events')
    .select('id, owner_id, status')
    .eq('id', eventId)
    .maybeSingle();
  if (eventError) {
    console.error('Failed to load event', eventError);
    return json(request, 500, { error: 'Could not load the event' });
  }
  if (!event || event.owner_id !== userData.user.id) {
    // Same answer for "missing" and "not yours" so event ids cannot be probed.
    return json(request, 403, { error: 'Only the organiser can draw names' });
  }
  if (event.status !== 'open') {
    return json(request, 409, { error: 'Names have already been drawn for this event' });
  }

  const [participantsResult, exclusionsResult] = await Promise.all([
    admin.from('participants').select('id').eq('event_id', eventId),
    admin.from('exclusions').select('participant_a, participant_b').eq('event_id', eventId),
  ]);
  if (participantsResult.error || exclusionsResult.error) {
    console.error('Failed to load draw data', participantsResult.error ?? exclusionsResult.error);
    return json(request, 500, { error: 'Could not load participants' });
  }

  const participantIds = participantsResult.data.map((p) => p.id as string);
  if (participantIds.length < MIN_PARTICIPANTS) {
    return json(request, 422, {
      error: `At least ${MIN_PARTICIPANTS} participants are required to draw names`,
    });
  }

  let pairs;
  try {
    pairs = drawAssignments(
      participantIds,
      exclusionsResult.data.map(
        (x) => [x.participant_a as string, x.participant_b as string] as const,
      ),
    );
  } catch (error) {
    if (error instanceof DrawImpossibleError) {
      return json(request, 422, { error: error.message });
    }
    throw error;
  }

  const { error: applyError } = await admin.rpc('apply_draw', {
    p_event_id: eventId,
    p_pairs: pairs,
  });
  if (applyError) {
    console.error('apply_draw failed', applyError);
    const conflict = applyError.message.includes('already been drawn');
    return json(request, conflict ? 409 : 500, {
      error: conflict ? 'Names have already been drawn for this event' : 'Could not save the draw',
    });
  }

  // Never return the pairs: each participant reads only their own assignment through RLS.
  return json(request, 200, { ok: true, participants: participantIds.length });
});
