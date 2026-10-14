/** open: joining + wishes · exclusions: list closed, everyone picks exclusions · drawn. */
export type EventStatus = 'open' | 'exclusions' | 'drawn';

export interface AppUser {
  id: string;
  email: string;
  displayName: string;
}

export interface GiftEvent {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  /** ISO date (yyyy-mm-dd) or null. */
  eventDate: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  currency: string;
  status: EventStatus;
  createdAt: string;
  drawnAt: string | null;
}

export interface EventSummary extends GiftEvent {
  isOwner: boolean;
}

export interface NewEvent {
  name: string;
  description: string;
  eventDate: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  currency: string;
}

export interface Participant {
  id: string;
  eventId: string;
  userId: string;
  displayName: string;
  joinedAt: string;
  /** Has filled in the wishes questionnaire. */
  profileCompleted: boolean;
  /** Has validated their exclusions (exclusions phase). */
  exclusionsConfirmed: boolean;
}

export interface EventDetail {
  event: GiftEvent;
  participants: Participant[];
  /** The current user's participant row in this event. */
  me: Participant;
  isOwner: boolean;
}

export interface Questionnaire {
  interests: string[];
  giftStyles: string[];
  avoid: string[];
  sizes: string;
  notes: string;
}

export interface WishlistItem {
  id: string;
  participantId: string;
  title: string;
  url: string | null;
  notes: string;
  price: number | null;
  /** 1 = would love it, 2 = would like it, 3 = nice to have. */
  priority: 1 | 2 | 3;
  createdAt: string;
}

export type NewWishlistItem = Pick<WishlistItem, 'title' | 'url' | 'notes' | 'price' | 'priority'>;

export interface GifteeProfile {
  participant: Participant;
  questionnaire: Questionnaire | null;
  wishlist: WishlistItem[];
}

/**
 * `santa`: the thread where I am the Secret Santa writing to my giftee.
 * `giftee`: the thread where I am the giftee talking to my (anonymous) Secret Santa.
 */
export type ThreadRole = 'santa' | 'giftee';

export interface Message {
  id: string;
  fromSanta: boolean;
  body: string;
  createdAt: string;
}

export interface InvitationPreview {
  eventId: string;
  eventName: string;
  ownerName: string;
  eventDate: string | null;
  alreadyMember: boolean;
}

export interface CreatedInvitation {
  token: string;
  expiresAt: string;
}

export const EMPTY_QUESTIONNAIRE: Questionnaire = {
  interests: [],
  giftStyles: [],
  avoid: [],
  sizes: '',
  notes: '',
};
