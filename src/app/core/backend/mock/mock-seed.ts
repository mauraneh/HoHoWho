import { MockDb } from './mock-db';

const day = 24 * 60 * 60 * 1000;
const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * day).toISOString();
const date = (offsetDays: number) => iso(offsetDays).slice(0, 10);

/**
 * Demo data for local development. Sign in with the demo personal links (#/k/demo-alice…)
 * or the organiser code MOCK_ORGANIZER_CODE. Alice and Bob are organisers.
 * - "Family Christmas" is open (Alice organises): try invitations, closing the list,
 *   exclusions and the draw (Bob and Carol already filled in their wishes).
 * - "Office Party" is already drawn: try the giftee page, recommendations and messages.
 */
/** Organiser code accepted by the demo backend. */
export const MOCK_ORGANIZER_CODE = 'noel';

export function createSeed(): MockDb {
  const users = [
    { id: 'u-alice', email: 'alice@example.com', displayName: 'Alice' },
    { id: 'u-bob', email: 'bob@example.com', displayName: 'Bob' },
    { id: 'u-carol', email: 'carol@example.com', displayName: 'Carol' },
    { id: 'u-dave', email: 'dave@example.com', displayName: 'Dave' },
  ];

  return {
    version: 4,
    organizers: ['alice@example.com', 'bob@example.com'],
    sessionUserId: null,
    users: users.map((u) => ({ ...u, key: `demo-${u.displayName.toLowerCase()}` })),
    events: [
      {
        id: 'e-family',
        ownerId: 'u-alice',
        name: 'Noël en famille',
        description: 'Échange de cadeaux chez mamie après le dîner.',
        eventDate: date(60),
        budgetMin: 20,
        budgetMax: 40,
        currency: 'EUR',
        status: 'open',
        createdAt: iso(-10),
        drawnAt: null,
      },
      {
        id: 'e-office',
        ownerId: 'u-bob',
        name: 'Repas d’équipe',
        description: 'Secret Santa pour le déjeuner de Noël du bureau.',
        eventDate: date(30),
        budgetMin: 10,
        budgetMax: 25,
        currency: 'EUR',
        status: 'drawn',
        createdAt: iso(-20),
        drawnAt: iso(-2),
      },
    ],
    participants: [
      ...users.map((u, i) => ({
        id: `p-family-${u.displayName.toLowerCase()}`,
        eventId: 'e-family',
        userId: u.id,
        displayName: u.displayName,
        joinedAt: iso(-10 + i),
        profileCompleted: u.displayName === 'Bob' || u.displayName === 'Carol',
        exclusionsConfirmed: false,
      })),
      ...users.slice(0, 3).map((u, i) => ({
        id: `p-office-${u.displayName.toLowerCase()}`,
        eventId: 'e-office',
        userId: u.id,
        displayName: u.displayName,
        joinedAt: iso(-20 + i),
        profileCompleted: true,
        exclusionsConfirmed: true,
      })),
    ],
    invitations: [],
    exclusions: [],
    assignments: [
      { id: 'a-1', eventId: 'e-office', giverId: 'p-office-alice', receiverId: 'p-office-carol' },
      { id: 'a-2', eventId: 'e-office', giverId: 'p-office-carol', receiverId: 'p-office-bob' },
      { id: 'a-3', eventId: 'e-office', giverId: 'p-office-bob', receiverId: 'p-office-alice' },
    ],
    questionnaires: [
      {
        participantId: 'p-family-bob',
        interests: ['board-games', 'coffee', 'music'],
        giftStyles: ['fun', 'practical'],
        avoid: ['clothing'],
        sizes: '',
        notes: 'Vient de se mettre aux vinyles.',
      },
      {
        participantId: 'p-family-carol',
        interests: ['plants', 'reading', 'tea'],
        giftStyles: ['cosy', 'eco'],
        avoid: ['alcohol'],
        sizes: 'Pulls : M',
        notes: '',
      },
      {
        participantId: 'p-office-carol',
        interests: ['coffee', 'reading', 'plants'],
        giftStyles: ['practical', 'cosy'],
        avoid: ['alcohol', 'clutter'],
        sizes: 'Pulls : M',
        notes: 'Adore tout ce qui est vert. En ce moment, plongée dans les romans policiers.',
      },
      {
        participantId: 'p-office-alice',
        interests: ['cooking', 'music', 'travel'],
        giftStyles: ['experience', 'consumable'],
        avoid: ['fragrance'],
        sizes: '',
        notes: 'Végétarienne.',
      },
      {
        participantId: 'p-office-bob',
        interests: ['gaming', 'tech', 'board-games'],
        giftStyles: ['fun'],
        avoid: [],
        sizes: 'T-shirts : L',
        notes: '',
      },
    ],
    wishlistItems: [
      {
        id: 'w-1',
        participantId: 'p-office-carol',
        title: 'Un bon roman policier',
        url: null,
        notes: 'Un Agatha Christie que je n’ai pas encore lu.',
        price: 15,
        priority: 1,
        createdAt: iso(-5),
      },
      {
        id: 'w-2',
        participantId: 'p-office-carol',
        title: 'Petite plante grasse en pot céramique',
        url: null,
        notes: '',
        price: 12,
        priority: 2,
        createdAt: iso(-4),
      },
    ],
    messages: [
      {
        id: 'm-1',
        eventId: 'e-office',
        receiverId: 'p-office-carol',
        fromSanta: true,
        body: 'Ho ho ho ! Tu préfères les livres de poche ou les grands formats ?',
        createdAt: iso(-1),
      },
    ],
  };
}
