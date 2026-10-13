import { signal } from '@angular/core';
import { DrawImpossibleError, drawAssignments } from '@shared/draw';
import {
  AppUser,
  CreatedInvitation,
  EventDetail,
  EventSummary,
  Exclusion,
  GifteeProfile,
  InvitationPreview,
  Message,
  NewEvent,
  NewWishlistItem,
  Questionnaire,
  ThreadRole,
  WishlistItem,
} from '../../models';
import { BackendError, HohowhoBackend, SignUpResult } from '../hohowho-backend';
import { MockDb } from './mock-db';
import { createSeed } from './mock-seed';

export const MOCK_STORAGE_KEY = 'hohowho.mock-db.v1';
const INVITATION_DAYS = 14;

const clone = <T>(value: T): T => structuredClone(value);
const now = () => new Date().toISOString();

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Development-only backend that keeps data in localStorage and applies the same authorization
 * rules as the Supabase RLS policies, so features behave identically without a server.
 */
export class MockBackend extends HohowhoBackend {
  private db: MockDb;
  private readonly user = signal<AppUser | null>(null);
  readonly currentUser = this.user.asReadonly();

  constructor(
    private readonly storage: Storage = localStorage,
    private readonly latencyMs = 80,
  ) {
    super();
    this.db = this.load();
    this.syncUser();
  }

  whenReady(): Promise<void> {
    return Promise.resolve();
  }

  /** Restores the demo data set (used by the "Reset demo data" action). */
  reset(): void {
    this.db = createSeed();
    this.save();
    this.syncUser();
  }

  // --- persistence ---------------------------------------------------------------------------

  private load(): MockDb {
    try {
      const raw = this.storage.getItem(MOCK_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as MockDb;
        if (parsed.version === 1) return parsed;
      }
    } catch {
      // Corrupted or unavailable storage: fall back to the seed.
    }
    const seed = createSeed();
    this.storage.setItem(MOCK_STORAGE_KEY, JSON.stringify(seed));
    return seed;
  }

  private save(): void {
    this.storage.setItem(MOCK_STORAGE_KEY, JSON.stringify(this.db));
  }

  private syncUser(): void {
    const u = this.db.users.find((x) => x.id === this.db.sessionUserId);
    this.user.set(u ? { id: u.id, email: u.email, displayName: u.displayName } : null);
  }

  /** Simulates network latency so loading states are exercised in development. */
  private async tick<T>(fn: () => T): Promise<T> {
    await new Promise((resolve) => setTimeout(resolve, this.latencyMs));
    const result = fn();
    this.save();
    return clone(result);
  }

  // --- authorization helpers (mirror the SQL helper functions) -------------------------------

  private uid(): string {
    const id = this.db.sessionUserId;
    if (!id) throw new BackendError('Please sign in first.');
    return id;
  }

  private event(eventId: string) {
    const event = this.db.events.find((e) => e.id === eventId);
    if (!event || !this.isMember(eventId)) throw new BackendError('Event not found.');
    return event;
  }

  private ownedOpenEvent(eventId: string) {
    const event = this.event(eventId);
    if (event.ownerId !== this.uid()) throw new BackendError('You are not allowed to do this.');
    if (event.status !== 'open') {
      throw new BackendError('This is no longer possible once names have been drawn.');
    }
    return event;
  }

  private isMember(eventId: string): boolean {
    const uid = this.db.sessionUserId;
    return this.db.participants.some((p) => p.eventId === eventId && p.userId === uid);
  }

  private isSelf(participantId: string): boolean {
    return this.db.participants.some((p) => p.id === participantId && p.userId === this.uid());
  }

  private isSantaOf(participantId: string): boolean {
    return this.db.assignments.some(
      (a) => a.receiverId === participantId && this.isSelf(a.giverId),
    );
  }

  private requireSelf(participantId: string): void {
    if (!this.isSelf(participantId)) throw new BackendError('You are not allowed to do this.');
  }

  private findInvitation(token: string) {
    const invitation = this.db.invitations.find(
      (i) => i.token === token && new Date(i.expiresAt) > new Date(),
    );
    const event = invitation && this.db.events.find((e) => e.id === invitation.eventId);
    if (!invitation || !event || event.status !== 'open') {
      throw new BackendError('This invitation is invalid or has expired');
    }
    return event;
  }

  // --- auth ------------------------------------------------------------------------------------

  signUp(email: string, password: string, displayName: string): Promise<SignUpResult> {
    return this.tick(() => {
      const normalized = email.trim().toLowerCase();
      if (this.db.users.some((u) => u.email === normalized)) {
        throw new BackendError('User already registered');
      }
      if (password.length < 6) throw new BackendError('Password should be at least 6 characters.');
      const id = crypto.randomUUID();
      const name = displayName.trim() || normalized.split('@')[0];
      this.db.users.push({ id, email: normalized, password, displayName: name.slice(0, 60) });
      this.db.sessionUserId = id;
      this.syncUser();
      return { needsEmailConfirmation: false };
    });
  }

  signIn(email: string, password: string): Promise<void> {
    return this.tick(() => {
      const user = this.db.users.find(
        (u) => u.email === email.trim().toLowerCase() && u.password === password,
      );
      if (!user) throw new BackendError('Invalid login credentials');
      this.db.sessionUserId = user.id;
      this.syncUser();
    });
  }

  signOut(): Promise<void> {
    return this.tick(() => {
      this.db.sessionUserId = null;
      this.syncUser();
    });
  }

  // --- events ----------------------------------------------------------------------------------

  listEvents(): Promise<EventSummary[]> {
    return this.tick(() => {
      const uid = this.uid();
      return this.db.events
        .filter((e) => this.isMember(e.id))
        .sort((a, b) => (a.eventDate ?? '9999').localeCompare(b.eventDate ?? '9999'))
        .map((e) => ({ ...e, isOwner: e.ownerId === uid }));
    });
  }

  createEvent(input: NewEvent): Promise<string> {
    return this.tick(() => {
      const uid = this.uid();
      const name = input.name.trim();
      if (!name || name.length > 80)
        throw new BackendError('Some values are invalid. Please check the form.');
      if (
        input.budgetMin !== null &&
        input.budgetMax !== null &&
        input.budgetMin > input.budgetMax
      ) {
        throw new BackendError('Some values are invalid. Please check the form.');
      }
      const id = crypto.randomUUID();
      this.db.events.push({
        id,
        ownerId: uid,
        name,
        description: input.description,
        eventDate: input.eventDate,
        budgetMin: input.budgetMin,
        budgetMax: input.budgetMax,
        currency: input.currency.toUpperCase(),
        status: 'open',
        createdAt: now(),
        drawnAt: null,
      });
      this.db.participants.push({
        id: crypto.randomUUID(),
        eventId: id,
        userId: uid,
        displayName: this.user()!.displayName,
        joinedAt: now(),
      });
      return id;
    });
  }

  getEvent(eventId: string): Promise<EventDetail> {
    return this.tick(() => {
      const uid = this.uid();
      const event = this.event(eventId);
      const participants = this.db.participants
        .filter((p) => p.eventId === eventId)
        .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt));
      const me = participants.find((p) => p.userId === uid)!;
      return { event, participants, me, isOwner: event.ownerId === uid };
    });
  }

  deleteEvent(eventId: string): Promise<void> {
    return this.tick(() => {
      const event = this.event(eventId);
      if (event.ownerId !== this.uid()) {
        throw new BackendError('Only the organiser can delete this event.');
      }
      const participantIds = new Set(
        this.db.participants.filter((p) => p.eventId === eventId).map((p) => p.id),
      );
      this.db.events = this.db.events.filter((e) => e.id !== eventId);
      this.db.participants = this.db.participants.filter((p) => p.eventId !== eventId);
      this.db.invitations = this.db.invitations.filter((i) => i.eventId !== eventId);
      this.db.exclusions = this.db.exclusions.filter((x) => x.eventId !== eventId);
      this.db.assignments = this.db.assignments.filter((a) => a.eventId !== eventId);
      this.db.messages = this.db.messages.filter((m) => m.eventId !== eventId);
      this.db.questionnaires = this.db.questionnaires.filter(
        (q) => !participantIds.has(q.participantId),
      );
      this.db.wishlistItems = this.db.wishlistItems.filter(
        (w) => !participantIds.has(w.participantId),
      );
    });
  }

  removeParticipant(participantId: string): Promise<void> {
    return this.tick(() => {
      const participant = this.db.participants.find((p) => p.id === participantId);
      const event = participant && this.db.events.find((e) => e.id === participant.eventId);
      const uid = this.uid();
      const allowed =
        participant &&
        event &&
        event.status === 'open' &&
        participant.userId !== event.ownerId &&
        (event.ownerId === uid || participant.userId === uid);
      if (!allowed) {
        throw new BackendError('This participant cannot be removed (names may already be drawn).');
      }
      this.db.participants = this.db.participants.filter((p) => p.id !== participantId);
      this.db.exclusions = this.db.exclusions.filter(
        (x) => x.participantA !== participantId && x.participantB !== participantId,
      );
      this.db.questionnaires = this.db.questionnaires.filter(
        (q) => q.participantId !== participantId,
      );
      this.db.wishlistItems = this.db.wishlistItems.filter(
        (w) => w.participantId !== participantId,
      );
    });
  }

  // --- invitations -----------------------------------------------------------------------------

  createInvitation(eventId: string): Promise<CreatedInvitation> {
    return this.tick(() => {
      this.ownedOpenEvent(eventId);
      const token = randomToken();
      const expiresAt = new Date(Date.now() + INVITATION_DAYS * 86_400_000).toISOString();
      this.db.invitations.push({ id: crypto.randomUUID(), eventId, token, expiresAt });
      return { token, expiresAt };
    });
  }

  revokeInvitations(eventId: string): Promise<void> {
    return this.tick(() => {
      if (this.event(eventId).ownerId !== this.uid()) {
        throw new BackendError('You are not allowed to do this.');
      }
      this.db.invitations = this.db.invitations.filter((i) => i.eventId !== eventId);
    });
  }

  countActiveInvitations(eventId: string): Promise<number> {
    return this.tick(() => {
      if (this.event(eventId).ownerId !== this.uid()) return 0;
      return this.db.invitations.filter(
        (i) => i.eventId === eventId && new Date(i.expiresAt) > new Date(),
      ).length;
    });
  }

  previewInvitation(token: string): Promise<InvitationPreview> {
    return this.tick(() => {
      this.uid();
      const event = this.findInvitation(token);
      const owner = this.db.users.find((u) => u.id === event.ownerId);
      return {
        eventId: event.id,
        eventName: event.name,
        ownerName: owner?.displayName ?? '',
        eventDate: event.eventDate,
        alreadyMember: this.isMember(event.id),
      };
    });
  }

  acceptInvitation(token: string): Promise<string> {
    return this.tick(() => {
      const uid = this.uid();
      const event = this.findInvitation(token);
      if (!this.isMember(event.id)) {
        this.db.participants.push({
          id: crypto.randomUUID(),
          eventId: event.id,
          userId: uid,
          displayName: this.user()!.displayName,
          joinedAt: now(),
        });
      }
      return event.id;
    });
  }

  // --- exclusions and draw ---------------------------------------------------------------------

  listExclusions(eventId: string): Promise<Exclusion[]> {
    return this.tick(() => {
      if (this.event(eventId).ownerId !== this.uid()) return [];
      return this.db.exclusions.filter((x) => x.eventId === eventId);
    });
  }

  addExclusion(eventId: string, participantA: string, participantB: string): Promise<void> {
    return this.tick(() => {
      this.ownedOpenEvent(eventId);
      const inEvent = (id: string) =>
        this.db.participants.some((p) => p.id === id && p.eventId === eventId);
      if (participantA === participantB || !inEvent(participantA) || !inEvent(participantB)) {
        throw new BackendError('Some values are invalid. Please check the form.');
      }
      const duplicate = this.db.exclusions.some(
        (x) =>
          x.eventId === eventId &&
          ((x.participantA === participantA && x.participantB === participantB) ||
            (x.participantA === participantB && x.participantB === participantA)),
      );
      if (duplicate) throw new BackendError('This already exists.');
      this.db.exclusions.push({ id: crypto.randomUUID(), eventId, participantA, participantB });
    });
  }

  removeExclusion(exclusionId: string): Promise<void> {
    return this.tick(() => {
      const exclusion = this.db.exclusions.find((x) => x.id === exclusionId);
      if (!exclusion) throw new BackendError('This exclusion can no longer be removed.');
      this.ownedOpenEvent(exclusion.eventId);
      this.db.exclusions = this.db.exclusions.filter((x) => x.id !== exclusionId);
    });
  }

  drawNames(eventId: string): Promise<void> {
    return this.tick(() => {
      const event = this.event(eventId);
      if (event.ownerId !== this.uid()) throw new BackendError('Only the organiser can draw names');
      if (event.status !== 'open') {
        throw new BackendError('Names have already been drawn for this event');
      }
      const ids = this.db.participants.filter((p) => p.eventId === eventId).map((p) => p.id);
      const exclusions = this.db.exclusions
        .filter((x) => x.eventId === eventId)
        .map((x) => [x.participantA, x.participantB] as const);
      try {
        for (const pair of drawAssignments(ids, exclusions)) {
          this.db.assignments.push({ id: crypto.randomUUID(), eventId, ...pair });
        }
      } catch (error) {
        if (error instanceof DrawImpossibleError) throw new BackendError(error.message);
        throw error;
      }
      event.status = 'drawn';
      event.drawnAt = now();
    });
  }

  // --- giftee, questionnaire, wishlist ---------------------------------------------------------

  getGiftee(eventId: string): Promise<GifteeProfile | null> {
    return this.tick(() => {
      this.event(eventId);
      const assignment = this.db.assignments.find(
        (a) => a.eventId === eventId && this.isSelf(a.giverId),
      );
      if (!assignment) return null;
      const participant = this.db.participants.find((p) => p.id === assignment.receiverId)!;
      const questionnaire = this.db.questionnaires.find((q) => q.participantId === participant.id);
      return {
        participant,
        questionnaire: questionnaire ? stripParticipant(questionnaire) : null,
        wishlist: this.wishlistOf(participant.id),
      };
    });
  }

  getMyQuestionnaire(participantId: string): Promise<Questionnaire | null> {
    return this.tick(() => {
      this.requireSelf(participantId);
      const q = this.db.questionnaires.find((x) => x.participantId === participantId);
      return q ? stripParticipant(q) : null;
    });
  }

  saveMyQuestionnaire(participantId: string, questionnaire: Questionnaire): Promise<void> {
    return this.tick(() => {
      this.requireSelf(participantId);
      this.db.questionnaires = this.db.questionnaires.filter(
        (q) => q.participantId !== participantId,
      );
      this.db.questionnaires.push({ ...clone(questionnaire), participantId });
    });
  }

  listMyWishlist(participantId: string): Promise<WishlistItem[]> {
    return this.tick(() => {
      this.requireSelf(participantId);
      return this.wishlistOf(participantId);
    });
  }

  addWishlistItem(participantId: string, item: NewWishlistItem): Promise<void> {
    return this.tick(() => {
      this.requireSelf(participantId);
      if (!item.title.trim() || (item.url !== null && !/^https?:\/\//i.test(item.url))) {
        throw new BackendError('Some values are invalid. Please check the form.');
      }
      this.db.wishlistItems.push({
        ...item,
        id: crypto.randomUUID(),
        participantId,
        createdAt: now(),
      });
    });
  }

  removeWishlistItem(itemId: string): Promise<void> {
    return this.tick(() => {
      const item = this.db.wishlistItems.find((w) => w.id === itemId);
      if (item) this.requireSelf(item.participantId);
      this.db.wishlistItems = this.db.wishlistItems.filter((w) => w.id !== itemId);
    });
  }

  private wishlistOf(participantId: string): WishlistItem[] {
    return this.db.wishlistItems
      .filter((w) => w.participantId === participantId)
      .sort((a, b) => a.priority - b.priority || a.createdAt.localeCompare(b.createdAt));
  }

  // --- anonymous messages ----------------------------------------------------------------------

  listMessages(eventId: string, receiverId: string): Promise<Message[]> {
    return this.tick(() => {
      if (!this.isSelf(receiverId) && !this.isSantaOf(receiverId)) return [];
      return this.db.messages
        .filter((m) => m.eventId === eventId && m.receiverId === receiverId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map(({ id, fromSanta, body, createdAt }) => ({ id, fromSanta, body, createdAt }));
    });
  }

  sendMessage(eventId: string, receiverId: string, role: ThreadRole, body: string): Promise<void> {
    return this.tick(() => {
      const text = body.trim();
      if (!text || text.length > 2000)
        throw new BackendError('Messages must be 1–2000 characters.');
      const hasSanta = this.db.assignments.some((a) => a.receiverId === receiverId);
      const allowed =
        role === 'santa' ? this.isSantaOf(receiverId) : this.isSelf(receiverId) && hasSanta;
      if (!allowed) throw new BackendError('You are not allowed to do this.');
      this.db.messages.push({
        id: crypto.randomUUID(),
        eventId,
        receiverId,
        fromSanta: role === 'santa',
        body: text,
        createdAt: now(),
      });
    });
  }
}

function stripParticipant(q: Questionnaire & { participantId: string }): Questionnaire {
  return {
    interests: q.interests,
    giftStyles: q.giftStyles,
    avoid: q.avoid,
    sizes: q.sizes,
    notes: q.notes,
  };
}
