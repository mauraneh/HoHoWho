import { Exclusion, GiftEvent, Participant, Questionnaire, WishlistItem } from '../../models';

/** Shape of the local development database persisted in localStorage. */
export interface MockDb {
  version: 1;
  sessionUserId: string | null;
  users: { id: string; email: string; password: string; displayName: string }[];
  events: GiftEvent[];
  participants: Participant[];
  invitations: { id: string; eventId: string; token: string; expiresAt: string }[];
  exclusions: Exclusion[];
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
