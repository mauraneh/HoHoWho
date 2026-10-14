import { Signal } from '@angular/core';
import {
  AppUser,
  CreatedInvitation,
  EventDetail,
  EventSummary,
  GifteeProfile,
  InvitationPreview,
  Message,
  NewEvent,
  NewWishlistItem,
  Questionnaire,
  ThreadRole,
  WishlistItem,
} from '../models';

/** Error whose message is safe and useful to show to the user. */
export class BackendError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackendError';
  }
}

/**
 * Accounts have no e-mail or password: each person owns a private "personal link" key
 * (`#/k/<key>`) that signs them in on any device.
 */
export type PersonalKey = string;

/**
 * Application data access. Feature code depends only on this contract; the implementation is
 * chosen at bootstrap (local mock data in development, Supabase otherwise).
 */
export abstract class HohowhoBackend {
  /** The signed-in user, or null. */
  abstract readonly currentUser: Signal<AppUser | null>;

  /** Resolves once a persisted session has been restored. */
  abstract whenReady(): Promise<void>;

  /** Creates an account from an invitation link and signs in. Returns the personal key. */
  abstract joinWithInvitation(displayName: string, invitationToken: string): Promise<PersonalKey>;
  /** Creates an organiser account with the organiser code and signs in. */
  abstract signUpAsOrganizer(displayName: string, code: string): Promise<PersonalKey>;
  /** Signs in with a personal key (from a personal link). */
  abstract signInWithKey(key: PersonalKey): Promise<void>;
  /** Issues a new personal key for the current user (the previous link stops working). */
  abstract resetMyKey(): Promise<PersonalKey>;
  /** Organiser: issues a new personal key for a participant who lost their link. */
  abstract resetParticipantKey(participantId: string): Promise<PersonalKey>;
  abstract signOut(): Promise<void>;

  /** Whether the current user may create a Secret Santa (organiser role). */
  abstract canOrganize(): Promise<boolean>;
  abstract listEvents(): Promise<EventSummary[]>;
  abstract createEvent(input: NewEvent): Promise<string>;
  abstract getEvent(eventId: string): Promise<EventDetail>;
  abstract deleteEvent(eventId: string): Promise<void>;
  abstract removeParticipant(participantId: string): Promise<void>;

  abstract createInvitation(eventId: string): Promise<CreatedInvitation>;
  abstract revokeInvitations(eventId: string): Promise<void>;
  abstract countActiveInvitations(eventId: string): Promise<number>;
  abstract previewInvitation(token: string): Promise<InvitationPreview>;
  abstract acceptInvitation(token: string): Promise<string>;

  /** Organiser: close the list so everyone moves on to choosing exclusions. */
  abstract closeRegistrations(eventId: string): Promise<void>;
  /** Organiser: reopen the list (resets everyone's exclusion choices). */
  abstract reopenRegistrations(eventId: string): Promise<void>;
  /** Organiser: e-mail addresses of all participants (for "e-mail everyone"). */
  abstract getParticipantEmails(eventId: string): Promise<string[]>;

  /** Participant ids the current user does not want to give a gift to. Private to them. */
  abstract getMyExclusions(eventId: string): Promise<string[]>;
  /** Saves the current user's exclusions and validates the step. */
  abstract submitExclusions(
    eventId: string,
    excludedIds: string[],
  ): Promise<{ everyoneConfirmed: boolean }>;
  /**
   * Draws names. Allowed for any participant once everyone has validated their exclusions,
   * and for the organiser at any time after closing the list.
   */
  abstract drawNames(eventId: string): Promise<void>;

  /** The participant the current user must buy a gift for, once names are drawn. */
  abstract getGiftee(eventId: string): Promise<GifteeProfile | null>;

  abstract getMyQuestionnaire(participantId: string): Promise<Questionnaire | null>;
  abstract saveMyQuestionnaire(participantId: string, questionnaire: Questionnaire): Promise<void>;
  abstract listMyWishlist(participantId: string): Promise<WishlistItem[]>;
  abstract addWishlistItem(participantId: string, item: NewWishlistItem): Promise<void>;
  abstract removeWishlistItem(itemId: string): Promise<void>;

  /**
   * @param receiverId participant id identifying the thread: my giftee's id for the `santa`
   *   thread, my own id for the `giftee` thread.
   */
  abstract listMessages(eventId: string, receiverId: string): Promise<Message[]>;
  abstract sendMessage(
    eventId: string,
    receiverId: string,
    role: ThreadRole,
    body: string,
  ): Promise<void>;
}
