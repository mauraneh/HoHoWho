import { GiftEvent, Participant, Questionnaire, WishlistItem } from '../../models';

/** Shape of the local development database persisted in localStorage. */
export interface MockDb {
  version: 3;
  /** E-mails allowed to create events (empty = everyone). */
  organizers: string[];
  sessionUserId: string | null;
  users: { id: string; email: string; displayName: string }[];
  events: GiftEvent[];
  participants: Participant[];
  invitations: { id: string; eventId: string; token: string; expiresAt: string }[];
  /** giverId does not want to give a gift to excludedId. */
  exclusions: { eventId: string; giverId: string; excludedId: string }[];
  assignments: { id: string; eventId: string; giverId: string; receiverId: string }[];
  questionnaires: (Questionnaire & { participantId: string })[];
  wishlistItems: WishlistItem[];
  messages: {
    id: string;
    eventId: string;
    receiverId: string;
    fromSanta: boolean;
    body: string;
    createdAt: string;
  }[];
}
