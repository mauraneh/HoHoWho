import { Signal } from '@angular/core';
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
} from '../models';

/** Error whose message is safe and useful to show to the user. */
export class BackendError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackendError';
  }
}

export interface SignUpResult {
  /** True when the account must be confirmed through the e-mail link before signing in. */
  needsEmailConfirmation: boolean;
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

  abstract signUp(email: string, password: string, displayName: string): Promise<SignUpResult>;
  abstract signIn(email: string, password: string): Promise<void>;
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

  abstract listExclusions(eventId: string): Promise<Exclusion[]>;
  abstract addExclusion(eventId: string, participantA: string, participantB: string): Promise<void>;
  abstract removeExclusion(exclusionId: string): Promise<void>;
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
