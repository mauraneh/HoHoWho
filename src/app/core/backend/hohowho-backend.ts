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

export interface SignInLinkResult {
  /** True when the user is already signed in (demo mode); false when a link was e-mailed. */
  signedIn: boolean;
}

/**
 * Application data access. Feature code depends only on this contract; the implementation is
 * chosen at bootstrap (local mock data in development, Supabase otherwise).
 */
export abstract class HohowhoBackend {
  /** The signed-in user, or null. */
  abstract readonly currentUser: Signal<AppUser | null>;

  /** Resolves once a persisted session has been restored. */
  abstract whenReady(): Promise<void>;

  /**
   * Passwordless sign-in: e-mails a one-click sign-in link. The account is created on first use.
   * @param displayName shown to other participants; only used when the account is created.
   * @param next in-app path to open after following the link (e.g. an invitation).
   */
  abstract requestSignInLink(
    email: string,
    displayName: string,
    next: string,
  ): Promise<SignInLinkResult>;
  /** Error reported by the auth server when a sign-in link failed (expired, already used…). */
  abstract consumeAuthError(): string | null;
  abstract signOut(): Promise<void>;

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
