import { signal } from '@angular/core';
import {
  createClient,
  FunctionsHttpError,
  PostgrestError,
  SupabaseClient,
  User,
} from '@supabase/supabase-js';
import { RuntimeConfig } from '../../config/runtime-config';
import {
  AppUser,
  CreatedInvitation,
  EventDetail,
  EventSummary,
  GiftEvent,
  GifteeProfile,
  InvitationPreview,
  Message,
  NewEvent,
  NewWishlistItem,
  Participant,
  Questionnaire,
  ThreadRole,
  WishlistItem,
} from '../../models';
import { BackendError, HohowhoBackend, SignInLinkResult } from '../hohowho-backend';

type Row = Record<string, unknown>;

const num = (value: unknown): number | null =>
  value === null || value === undefined ? null : Number(value);

function toEvent(row: Row): GiftEvent {
  return {
    id: row['id'] as string,
    ownerId: row['owner_id'] as string,
    name: row['name'] as string,
    description: (row['description'] as string) ?? '',
    eventDate: (row['event_date'] as string | null) ?? null,
    budgetMin: num(row['budget_min']),
    budgetMax: num(row['budget_max']),
    currency: row['currency'] as string,
    status: row['status'] as GiftEvent['status'],
    createdAt: row['created_at'] as string,
    drawnAt: (row['drawn_at'] as string | null) ?? null,
  };
}

function toParticipant(row: Row): Participant {
  return {
    id: row['id'] as string,
    eventId: row['event_id'] as string,
    userId: row['user_id'] as string,
    displayName: row['display_name'] as string,
    joinedAt: row['joined_at'] as string,
    profileCompleted: row['profile_completed_at'] != null,
    exclusionsConfirmed: row['exclusions_confirmed_at'] != null,
  };
}

function toQuestionnaire(row: Row): Questionnaire {
  return {
    interests: (row['interests'] as string[]) ?? [],
    giftStyles: (row['gift_styles'] as string[]) ?? [],
    avoid: (row['avoid'] as string[]) ?? [],
    sizes: (row['sizes'] as string) ?? '',
    notes: (row['notes'] as string) ?? '',
  };
}

function toWishlistItem(row: Row): WishlistItem {
  return {
    id: row['id'] as string,
    participantId: row['participant_id'] as string,
    title: row['title'] as string,
    url: (row['url'] as string | null) ?? null,
    notes: (row['notes'] as string) ?? '',
    price: num(row['price']),
    priority: row['priority'] as WishlistItem['priority'],
    createdAt: row['created_at'] as string,
  };
}

function toUser(user: User): AppUser {
  const metadataName = user.user_metadata?.['display_name'];
  return {
    id: user.id,
    email: user.email ?? '',
    displayName:
      typeof metadataName === 'string' && metadataName.trim()
        ? metadataName.trim()
        : (user.email ?? '').split('@')[0],
  };
}

function friendlyAuthError(error: { message: string; status?: number; code?: string }): string {
  const message = error.message ?? '';
  if (error.status === 429 || /rate limit/i.test(message)) {
    return 'Too many sign-in e-mails were sent. Please wait a few minutes and try again.';
  }
  if (/email/i.test(message) && /(valid|format)/i.test(message)) {
    return 'Please enter a valid e-mail address.';
  }
  if (/expired|invalid/i.test(message)) {
    return 'This sign-in link has expired or was already used. Request a new one below.';
  }
  console.error(error);
  return 'We could not send the sign-in link. Please try again.';
}

/** Converts database errors into messages that are safe to display. */
function fail(error: PostgrestError | { message: string; code?: string }): never {
  switch (error.code) {
    case '42501':
      // Raised by our RPCs with a friendly message, or by Postgres for missing privileges.
      throw new BackendError(
        error.message.startsWith('permission denied') ||
          error.message.includes('row-level security')
          ? 'You are not allowed to do this.'
          : error.message,
      );
    case '23505':
      throw new BackendError('This already exists.');
    case '23514':
    case '22P02':
      throw new BackendError('Some values are invalid. Please check the form.');
    case 'P0001':
    case 'P0002':
    case '22023':
      throw new BackendError(error.message);
    default:
      console.error(error);
      throw new BackendError('Something went wrong. Please try again.');
  }
}

/** HohowhoBackend implementation backed by Supabase (Auth, PostgREST + RLS, Edge Functions). */
export class SupabaseBackend extends HohowhoBackend {
  private readonly client: SupabaseClient;
  private readonly user = signal<AppUser | null>(null);
  private readonly ready: Promise<void>;
  readonly currentUser = this.user.asReadonly();

  private authError: string | null = null;

  constructor(config: RuntimeConfig) {
    super();
    this.client = createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: {
        // Implicit flow: the e-mailed link signs in on any device or browser (PKCE would require
        // opening it in the browser that requested it). The tokens arrive in the URL fragment and
        // are consumed before the router starts (see createBackend).
        flowType: 'implicit',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
    this.client.auth.onAuthStateChange((_event, session) => {
      this.user.set(session?.user ? toUser(session.user) : null);
    });
    this.ready = this.client.auth.getSession().then(({ data, error }) => {
      this.user.set(data.session?.user ? toUser(data.session.user) : null);
      this.cleanAuthFragment();
      if (error && !this.authError) this.authError = friendlyAuthError(error);
    });
  }

  /** Removes auth tokens or errors left in the URL fragment so the router never sees them. */
  private cleanAuthFragment(): void {
    const fragment = window.location.hash.replace(/^#/, '');
    if (!/(^|&)(access_token|error|error_code|error_description)=/.test(fragment)) return;
    const description = new URLSearchParams(fragment).get('error_description');
    if (description) this.authError = friendlyAuthError({ message: description });
    window.history.replaceState(
      window.history.state,
      '',
      window.location.pathname + window.location.search,
    );
  }

  consumeAuthError(): string | null {
    const error = this.authError;
    this.authError = null;
    return error;
  }

  whenReady(): Promise<void> {
    return this.ready;
  }

  private requireUser(): AppUser {
    const user = this.user();
    if (!user) throw new BackendError('Please sign in first.');
    return user;
  }

  async requestSignInLink(
    email: string,
    displayName: string,
    next: string,
  ): Promise<SignInLinkResult> {
    const redirect = new URL(document.baseURI);
    redirect.hash = '';
    if (next && next !== '/events') redirect.searchParams.set('next', next);
    const name = displayName.trim();
    const { error } = await this.client.auth.signInWithOtp({
      email: email.trim(),
      options: {
        shouldCreateUser: true,
        emailRedirectTo: redirect.toString(),
        data: name ? { display_name: name } : undefined,
      },
    });
    if (error) throw new BackendError(friendlyAuthError(error));
    return { signedIn: false };
  }

  async signOut(): Promise<void> {
    const { error } = await this.client.auth.signOut();
    if (error) throw new BackendError(error.message);
  }

  async canOrganize(): Promise<boolean> {
    const { data, error } = await this.client.rpc('can_organize');
    if (error) fail(error);
    return data === true;
  }

  async listEvents(): Promise<EventSummary[]> {
    const me = this.requireUser();
    const { data, error } = await this.client
      .from('events')
      .select('*')
      .order('event_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false });
    if (error) fail(error);
    return data.map((row) => {
      const event = toEvent(row);
      return { ...event, isOwner: event.ownerId === me.id };
    });
  }

  async createEvent(input: NewEvent): Promise<string> {
    const { data, error } = await this.client.rpc('create_event', {
      p_name: input.name,
      p_description: input.description,
      p_event_date: input.eventDate,
      p_budget_min: input.budgetMin,
      p_budget_max: input.budgetMax,
      p_currency: input.currency,
    });
    if (error) fail(error);
    return data as string;
  }

  async getEvent(eventId: string): Promise<EventDetail> {
    const me = this.requireUser();
    const [eventResult, participantsResult] = await Promise.all([
      this.client.from('events').select('*').eq('id', eventId).maybeSingle(),
      this.client.from('participants').select('*').eq('event_id', eventId).order('joined_at'),
    ]);
    if (eventResult.error) fail(eventResult.error);
    if (participantsResult.error) fail(participantsResult.error);
    if (!eventResult.data) throw new BackendError('Event not found.');

    const event = toEvent(eventResult.data);
    const participants = participantsResult.data.map(toParticipant);
    const mine = participants.find((p) => p.userId === me.id);
    if (!mine) throw new BackendError('Event not found.');
    return { event, participants, me: mine, isOwner: event.ownerId === me.id };
  }

  async deleteEvent(eventId: string): Promise<void> {
    const { data, error } = await this.client
      .from('events')
      .delete()
      .eq('id', eventId)
      .select('id');
    if (error) fail(error);
    if (data.length === 0) throw new BackendError('Only the organiser can delete this event.');
  }

  async removeParticipant(participantId: string): Promise<void> {
    const { data, error } = await this.client
      .from('participants')
      .delete()
      .eq('id', participantId)
      .select('id');
    if (error) fail(error);
    if (data.length === 0) {
      throw new BackendError('This participant cannot be removed (names may already be drawn).');
    }
  }

  async createInvitation(eventId: string): Promise<CreatedInvitation> {
    const { data, error } = await this.client.rpc('create_invitation', { p_event_id: eventId });
    if (error) fail(error);
    const row = (data as Row[])[0];
    return { token: row['token'] as string, expiresAt: row['expires_at'] as string };
  }

  async revokeInvitations(eventId: string): Promise<void> {
    const { error } = await this.client.from('invitations').delete().eq('event_id', eventId);
    if (error) fail(error);
  }

  async countActiveInvitations(eventId: string): Promise<number> {
    const { count, error } = await this.client
      .from('invitations')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .gt('expires_at', new Date().toISOString());
    if (error) fail(error);
    return count ?? 0;
  }

  async previewInvitation(token: string): Promise<InvitationPreview> {
    const { data, error } = await this.client.rpc('preview_invitation', { p_token: token });
    if (error) fail(error);
    const row = (data as Row[])[0];
    return {
      eventId: row['event_id'] as string,
      eventName: row['event_name'] as string,
      ownerName: row['owner_name'] as string,
      eventDate: (row['event_date'] as string | null) ?? null,
      alreadyMember: row['already_member'] as boolean,
    };
  }

  async acceptInvitation(token: string): Promise<string> {
    const { data, error } = await this.client.rpc('accept_invitation', { p_token: token });
    if (error) fail(error);
    return data as string;
  }

  async closeRegistrations(eventId: string): Promise<void> {
    const { error } = await this.client.rpc('close_registrations', { p_event_id: eventId });
    if (error) fail(error);
  }

  async reopenRegistrations(eventId: string): Promise<void> {
    const { error } = await this.client.rpc('reopen_registrations', { p_event_id: eventId });
    if (error) fail(error);
  }

  async getParticipantEmails(eventId: string): Promise<string[]> {
    const { data, error } = await this.client.rpc('participant_emails', { p_event_id: eventId });
    if (error) fail(error);
    return (data as Row[]).map((row) => row['email'] as string).filter(Boolean);
  }

  async getMyExclusions(eventId: string): Promise<string[]> {
    // RLS only returns the current user's own choices.
    const { data, error } = await this.client
      .from('exclusions')
      .select('excluded_id')
      .eq('event_id', eventId);
    if (error) fail(error);
    return data.map((row) => row['excluded_id'] as string);
  }

  async submitExclusions(
    eventId: string,
    excludedIds: string[],
  ): Promise<{ everyoneConfirmed: boolean }> {
    const { data, error } = await this.client.rpc('submit_exclusions', {
      p_event_id: eventId,
      p_excluded: excludedIds,
    });
    if (error) fail(error);
    return { everyoneConfirmed: data === true };
  }

  async drawNames(eventId: string): Promise<void> {
    const { error } = await this.client.functions.invoke('draw-assignments', {
      body: { eventId },
    });
    if (!error) return;
    if (error instanceof FunctionsHttpError) {
      const body = await (error.context as Response).json().catch(() => null);
      throw new BackendError(body?.error ?? 'The draw failed. Please try again.');
    }
    console.error(error);
    throw new BackendError('Could not reach the draw service. Please try again.');
  }

  async getGiftee(eventId: string): Promise<GifteeProfile | null> {
    // RLS only returns the assignment where the current user is the giver.
    const { data: assignment, error } = await this.client
      .from('assignments')
      .select('receiver_id')
      .eq('event_id', eventId)
      .maybeSingle();
    if (error) fail(error);
    if (!assignment) return null;

    const receiverId = assignment['receiver_id'] as string;
    const [participant, questionnaire, wishlist] = await Promise.all([
      this.client.from('participants').select('*').eq('id', receiverId).single(),
      this.client.from('questionnaires').select('*').eq('participant_id', receiverId).maybeSingle(),
      this.client
        .from('wishlist_items')
        .select('*')
        .eq('participant_id', receiverId)
        .order('priority')
        .order('created_at'),
    ]);
    if (participant.error) fail(participant.error);
    if (questionnaire.error) fail(questionnaire.error);
    if (wishlist.error) fail(wishlist.error);
    return {
      participant: toParticipant(participant.data),
      questionnaire: questionnaire.data ? toQuestionnaire(questionnaire.data) : null,
      wishlist: wishlist.data.map(toWishlistItem),
    };
  }

  async getMyQuestionnaire(participantId: string): Promise<Questionnaire | null> {
    const { data, error } = await this.client
      .from('questionnaires')
      .select('*')
      .eq('participant_id', participantId)
      .maybeSingle();
    if (error) fail(error);
    return data ? toQuestionnaire(data) : null;
  }

  async saveMyQuestionnaire(participantId: string, q: Questionnaire): Promise<void> {
    const { error } = await this.client.from('questionnaires').upsert(
      {
        participant_id: participantId,
        interests: q.interests,
        gift_styles: q.giftStyles,
        avoid: q.avoid,
        sizes: q.sizes,
        notes: q.notes,
      },
      { onConflict: 'participant_id' },
    );
    if (error) fail(error);
  }

  async listMyWishlist(participantId: string): Promise<WishlistItem[]> {
    const { data, error } = await this.client
      .from('wishlist_items')
      .select('*')
      .eq('participant_id', participantId)
      .order('priority')
      .order('created_at');
    if (error) fail(error);
    return data.map(toWishlistItem);
  }

  async addWishlistItem(participantId: string, item: NewWishlistItem): Promise<void> {
    const { error } = await this.client.from('wishlist_items').insert({
      participant_id: participantId,
      title: item.title,
      url: item.url,
      notes: item.notes,
      price: item.price,
      priority: item.priority,
    });
    if (error) fail(error);
  }

  async removeWishlistItem(itemId: string): Promise<void> {
    const { error } = await this.client.from('wishlist_items').delete().eq('id', itemId);
    if (error) fail(error);
  }

  async listMessages(eventId: string, receiverId: string): Promise<Message[]> {
    const { data, error } = await this.client
      .from('messages')
      .select('id, from_santa, body, created_at')
      .eq('event_id', eventId)
      .eq('receiver_id', receiverId)
      .order('created_at')
      .limit(500);
    if (error) fail(error);
    return data.map((row) => ({
      id: row['id'],
      fromSanta: row['from_santa'],
      body: row['body'],
      createdAt: row['created_at'],
    }));
  }

  async sendMessage(
    eventId: string,
    receiverId: string,
    role: ThreadRole,
    body: string,
  ): Promise<void> {
    const { error } = await this.client.from('messages').insert({
      event_id: eventId,
      receiver_id: receiverId,
      from_santa: role === 'santa',
      body: body.trim(),
    });
    if (error) fail(error);
  }
}
