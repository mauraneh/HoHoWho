import { BackendError } from '../hohowho-backend';
import { MockBackend } from './mock-backend';
import { MOCK_PASSWORD } from './mock-seed';

class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length() {
    return this.data.size;
  }
  clear() {
    this.data.clear();
  }
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  key(index: number) {
    return [...this.data.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
}

describe('MockBackend', () => {
  let storage: MemoryStorage;
  let backend: MockBackend;

  const as = async (email: string, password = MOCK_PASSWORD) => {
    if (backend.currentUser()) await backend.signOut();
    await backend.signIn(email, password);
  };

  beforeEach(() => {
    storage = new MemoryStorage();
    backend = new MockBackend(storage, 0);
  });

  it('signs in with demo accounts and rejects wrong passwords', async () => {
    await expect(backend.signIn('alice@example.com', 'nope')).rejects.toBeInstanceOf(BackendError);
    await backend.signIn('ALICE@example.com', MOCK_PASSWORD);
    expect(backend.currentUser()?.displayName).toBe('Alice');
  });

  it('persists the session and data across instances', async () => {
    await backend.signIn('alice@example.com', MOCK_PASSWORD);
    const restored = new MockBackend(storage, 0);
    expect(restored.currentUser()?.email).toBe('alice@example.com');
  });

  it('runs a complete Secret Santa', async () => {
    await backend.signUp('zoe@example.com', 'secret123', 'Zoe');
    const eventId = await backend.createEvent({
      name: 'Book club',
      description: '',
      eventDate: null,
      budgetMin: 10,
      budgetMax: 20,
      currency: 'eur',
    });
    const { token } = await backend.createInvitation(eventId);
    await expect(backend.drawNames(eventId)).rejects.toThrow(/At least 3/);

    for (const email of ['alice@example.com', 'bob@example.com', 'carol@example.com']) {
      await as(email);
      const preview = await backend.previewInvitation(token);
      expect(preview).toMatchObject({
        eventName: 'Book club',
        ownerName: 'Zoe',
        alreadyMember: false,
      });
      expect(await backend.acceptInvitation(token)).toBe(eventId);
      await expect(backend.createInvitation(eventId)).rejects.toThrow(/not allowed/);
      await expect(backend.drawNames(eventId)).rejects.toThrow(/organiser/);
    }

    await as('zoe@example.com', 'secret123');
    const detail = await backend.getEvent(eventId);
    expect(detail.participants).toHaveLength(4);
    expect(detail.event.currency).toBe('EUR');
    const [zoe, alice] = detail.participants;
    await backend.addExclusion(eventId, zoe.id, alice.id);
    await expect(backend.addExclusion(eventId, alice.id, zoe.id)).rejects.toThrow(/already exists/);
    await backend.drawNames(eventId);
    await expect(backend.drawNames(eventId)).rejects.toThrow(/already been drawn/);
    await expect(backend.previewInvitation(token)).rejects.toThrow(/invalid or has expired/);

    const zoeGiftee = await backend.getGiftee(eventId);
    expect(zoeGiftee).not.toBeNull();
    expect([zoe.id, alice.id]).not.toContain(zoeGiftee!.participant.id);

    // Every participant has exactly one giftee and everybody is drawn exactly once.
    const receivers: string[] = [];
    for (const email of [
      'zoe@example.com',
      'alice@example.com',
      'bob@example.com',
      'carol@example.com',
    ]) {
      await as(email, email.startsWith('zoe') ? 'secret123' : MOCK_PASSWORD);
      receivers.push((await backend.getGiftee(eventId))!.participant.id);
    }
    expect(new Set(receivers).size).toBe(4);
  });

  it('keeps wishes private until the draw and shares them with the Santa only', async () => {
    await as('carol@example.com');
    const office = await backend.getEvent('e-office');
    await backend.addWishlistItem(office.me.id, {
      title: 'Socks',
      url: 'https://example.com/socks',
      notes: '',
      price: 10,
      priority: 1,
    });
    await expect(
      backend.addWishlistItem('p-office-bob', {
        title: 'Hack',
        url: null,
        notes: '',
        price: null,
        priority: 1,
      }),
    ).rejects.toThrow(/not allowed/);
    await expect(
      backend.addWishlistItem(office.me.id, {
        title: 'Bad',
        url: 'javascript:alert(1)',
        notes: '',
        price: null,
        priority: 1,
      }),
    ).rejects.toThrow(/invalid/);

    // Alice is Carol's Santa in the seed.
    await as('alice@example.com');
    const giftee = await backend.getGiftee('e-office');
    expect(giftee?.participant.displayName).toBe('Carol');
    expect(giftee?.wishlist.map((w) => w.title)).toContain('Socks');
    await expect(backend.getMyQuestionnaire('p-office-carol')).rejects.toThrow(/not allowed/);

    // Dave is not part of the office event at all.
    await as('dave@example.com');
    await expect(backend.getEvent('e-office')).rejects.toThrow(/not found/);
  });

  it('lets Santa and giftee talk without revealing the Santa', async () => {
    await as('alice@example.com');
    await backend.sendMessage('e-office', 'p-office-carol', 'santa', 'Paperback?');
    await expect(backend.sendMessage('e-office', 'p-office-bob', 'santa', 'Fake')).rejects.toThrow(
      /not allowed/,
    );

    await as('carol@example.com');
    const thread = await backend.listMessages('e-office', 'p-office-carol');
    expect(thread.map((m) => m.body)).toEqual([
      'Ho ho ho! Do you prefer paperback or hardcover?',
      'Paperback?',
    ]);
    expect(Object.keys(thread[0]).sort()).toEqual(['body', 'createdAt', 'fromSanta', 'id']);
    await backend.sendMessage('e-office', 'p-office-carol', 'giftee', 'Paperback please');

    await as('bob@example.com');
    expect(await backend.listMessages('e-office', 'p-office-carol')).toEqual([]);
  });

  it('protects organiser-only actions', async () => {
    await as('bob@example.com');
    const family = await backend.getEvent('e-family');
    expect(family.isOwner).toBe(false);
    expect(await backend.listExclusions('e-family')).toEqual([]);
    await expect(backend.removeParticipant('p-family-carol')).rejects.toBeInstanceOf(BackendError);
    await expect(backend.removeParticipant('p-family-alice')).rejects.toBeInstanceOf(BackendError);
    await expect(backend.deleteEvent('e-family')).rejects.toThrow(/organiser/);

    await as('alice@example.com');
    await backend.removeParticipant('p-family-dave');
    expect(await backend.listExclusions('e-family')).toEqual([]);
    await backend.deleteEvent('e-family');
    expect((await backend.listEvents()).map((e) => e.id)).not.toContain('e-family');
  });
});
