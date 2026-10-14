import { BackendError } from '../hohowho-backend';
import { MOCK_STORAGE_KEY, MockBackend } from './mock-backend';
import { createSeed } from './mock-seed';

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

  const as = async (email: string, name = '') => {
    if (backend.currentUser()) await backend.signOut();
    await backend.requestSignInLink(email, name);
  };

  beforeEach(() => {
    storage = new MemoryStorage();
    backend = new MockBackend(storage, 0);
  });

  it('signs in with just an e-mail and creates the account on first use', async () => {
    await expect(backend.requestSignInLink('not-an-email', '')).rejects.toBeInstanceOf(
      BackendError,
    );
    expect(await backend.requestSignInLink('ALICE@example.com', 'Ignored')).toEqual({
      signedIn: true,
    });
    expect(backend.currentUser()?.displayName).toBe('Alice');
    await as('zoe@example.com', 'Zoé');
    expect(backend.currentUser()?.displayName).toBe('Zoé');
    expect(backend.consumeAuthError()).toBeNull();
  });

  it('persists the session and data across instances', async () => {
    await as('alice@example.com');
    const restored = new MockBackend(storage, 0);
    expect(restored.currentUser()?.email).toBe('alice@example.com');
  });

  it('only lets organisers create a Secret Santa', async () => {
    await as('carol@example.com');
    expect(await backend.canOrganize()).toBe(false);
    await expect(
      backend.createEvent({
        name: 'Nope',
        description: '',
        eventDate: null,
        budgetMin: null,
        budgetMax: null,
        currency: 'EUR',
      }),
    ).rejects.toThrow(/Only organisers/);
    await as('alice@example.com');
    expect(await backend.canOrganize()).toBe(true);
  });

  it('runs the full flow: join, wishes, close, exclusions, automatic draw', async () => {
    // Empty organiser list: anyone may organise.
    storage.setItem(MOCK_STORAGE_KEY, JSON.stringify({ ...createSeed(), organizers: [] }));
    backend = new MockBackend(storage, 0);
    await as('zoe@example.com', 'Zoe');
    const eventId = await backend.createEvent({
      name: 'Book club',
      description: '',
      eventDate: null,
      budgetMin: 10,
      budgetMax: 20,
      currency: 'eur',
    });
    const { token } = await backend.createInvitation(eventId);
    await expect(backend.closeRegistrations(eventId)).rejects.toThrow(/At least 3/);

    for (const email of ['alice@example.com', 'bob@example.com', 'carol@example.com']) {
      await as(email);
      expect(await backend.previewInvitation(token)).toMatchObject({
        eventName: 'Book club',
        ownerName: 'Zoe',
      });
      expect(await backend.acceptInvitation(token)).toBe(eventId);
      const { me } = await backend.getEvent(eventId);
      expect(me.profileCompleted).toBe(false);
      await backend.saveMyQuestionnaire(me.id, {
        interests: ['reading'],
        giftStyles: [],
        avoid: [],
        sizes: '',
        notes: '',
      });
      expect((await backend.getEvent(eventId)).me.profileCompleted).toBe(true);
      await expect(backend.submitExclusions(eventId, [])).rejects.toThrow(/list is closed/);
      await expect(backend.closeRegistrations(eventId)).rejects.toThrow(/not allowed/);
    }

    await as('zoe@example.com');
    expect((await backend.getParticipantEmails(eventId)).sort()).toEqual([
      'alice@example.com',
      'bob@example.com',
      'carol@example.com',
      'zoe@example.com',
    ]);
    await backend.closeRegistrations(eventId);
    await expect(backend.previewInvitation(token)).rejects.toThrow(/list is already closed/);
    const { participants } = await backend.getEvent(eventId);
    const id = (name: string) => participants.find((p) => p.displayName === name)!.id;

    // Zoe refuses Alice; Alice refuses Bob.
    expect(await backend.submitExclusions(eventId, [id('Alice')])).toEqual({
      everyoneConfirmed: false,
    });
    expect(await backend.getMyExclusions(eventId)).toEqual([id('Alice')]);
    await as('alice@example.com');
    expect(await backend.getMyExclusions(eventId)).toEqual([]);
    await expect(backend.submitExclusions(eventId, [id('Alice')])).rejects.toThrow(/yourself/);
    await expect(
      backend.submitExclusions(eventId, [id('Bob'), id('Carol'), id('Zoe')]),
    ).rejects.toThrow(/at least one/);
    await backend.submitExclusions(eventId, [id('Bob')]);
    await expect(backend.drawNames(eventId)).rejects.toThrow(/Waiting for 2/);

    await as('bob@example.com');
    await backend.submitExclusions(eventId, []);
    await as('carol@example.com');
    expect(await backend.submitExclusions(eventId, [])).toEqual({ everyoneConfirmed: true });
    await backend.drawNames(eventId);
    await expect(backend.drawNames(eventId)).rejects.toThrow(/already been drawn/);

    const receivers: string[] = [];
    for (const [email, refused] of [
      ['zoe@example.com', 'Alice'],
      ['alice@example.com', 'Bob'],
      ['bob@example.com', null],
      ['carol@example.com', null],
    ] as const) {
      await as(email);
      const giftee = (await backend.getGiftee(eventId))!.participant;
      if (refused) expect(giftee.displayName).not.toBe(refused);
      receivers.push(giftee.id);
    }
    expect(new Set(receivers).size).toBe(4);
  });

  it('lets the organiser reopen the list or force the draw', async () => {
    await as('alice@example.com');
    await backend.closeRegistrations('e-family');
    await backend.submitExclusions('e-family', ['p-family-bob']);
    await backend.reopenRegistrations('e-family');
    expect(await backend.getMyExclusions('e-family')).toEqual([]);
    expect((await backend.getEvent('e-family')).event.status).toBe('open');

    await backend.closeRegistrations('e-family');
    await as('bob@example.com');
    await expect(backend.reopenRegistrations('e-family')).rejects.toThrow(/not allowed/);
    await expect(backend.drawNames('e-family')).rejects.toThrow(/Waiting/);
    await as('alice@example.com');
    await backend.drawNames('e-family');
    expect((await backend.getEvent('e-family')).event.status).toBe('drawn');
  });

  it('keeps wishes private and shares them with the Santa only', async () => {
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

    // Alice is Carol's Santa in the seed.
    await as('alice@example.com');
    const giftee = await backend.getGiftee('e-office');
    expect(giftee?.participant.displayName).toBe('Carol');
    expect(giftee?.wishlist.map((w) => w.title)).toContain('Socks');
    await expect(backend.getMyQuestionnaire('p-office-carol')).rejects.toThrow(/not allowed/);

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
      'Ho ho ho ! Tu préfères les livres de poche ou les grands formats ?',
      'Paperback?',
    ]);
    expect(Object.keys(thread[0]).sort()).toEqual(['body', 'createdAt', 'fromSanta', 'id']);

    await as('bob@example.com');
    expect(await backend.listMessages('e-office', 'p-office-carol')).toEqual([]);
  });

  it('protects organiser-only actions', async () => {
    await as('bob@example.com');
    await expect(backend.removeParticipant('p-family-carol')).rejects.toBeInstanceOf(BackendError);
    await expect(backend.deleteEvent('e-family')).rejects.toThrow(/organiser/);
    await expect(backend.getParticipantEmails('e-family')).rejects.toThrow(/organiser/);

    await as('alice@example.com');
    await backend.removeParticipant('p-family-dave');
    await backend.deleteEvent('e-family');
    expect((await backend.listEvents()).map((e) => e.id)).not.toContain('e-family');
  });
});
