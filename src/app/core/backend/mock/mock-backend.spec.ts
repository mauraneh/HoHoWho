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

  /** Signs in with a demo personal link (`demo-alice`…) or any personal key. */
  const as = async (who: string) => {
    if (backend.currentUser()) await backend.signOut();
    await backend.signInWithKey(who.includes('-') || who.length > 20 ? who : `demo-${who}`);
  };

  beforeEach(() => {
    storage = new MemoryStorage();
    backend = new MockBackend(storage, 0);
  });

  it('signs in with personal links and creates accounts from invitations or the organiser code', async () => {
    await expect(backend.signInWithKey('nope')).rejects.toThrow(/not valid/);
    await as('alice');
    expect(backend.currentUser()?.displayName).toBe('Alice');
    const { token } = await backend.createInvitation('e-family');
    await backend.signOut();

    await expect(backend.joinWithInvitation('Zoé', 'bad-token')).rejects.toThrow(/invalid/);
    const zoeKey = await backend.joinWithInvitation('Zoé', token);
    expect(backend.currentUser()?.displayName).toBe('Zoé');
    expect(await backend.canOrganize()).toBe(false);

    await expect(backend.signUpAsOrganizer('Max', 'wrong')).rejects.toThrow(/Wrong organiser code/);
    await backend.signUpAsOrganizer('Max', 'noel');
    expect(await backend.canOrganize()).toBe(true);

    await as(zoeKey);
    expect(backend.currentUser()?.displayName).toBe('Zoé');
    const newKey = await backend.resetMyKey();
    await backend.signOut();
    await expect(backend.signInWithKey(zoeKey)).rejects.toThrow(/not valid/);
    await backend.signInWithKey(newKey);
    expect(backend.currentUser()?.displayName).toBe('Zoé');
  });

  it('lets the organiser issue a new link for a participant', async () => {
    await as('bob');
    await expect(backend.resetParticipantKey('p-family-carol')).rejects.toThrow(/organiser/);
    await as('alice');
    const carolKey = await backend.resetParticipantKey('p-family-carol');
    await expect(as('carol')).rejects.toThrow(/not valid/);
    await as(carolKey);
    expect(backend.currentUser()?.displayName).toBe('Carol');
  });

  it('persists the session and data across instances', async () => {
    await as('alice');
    const restored = new MockBackend(storage, 0);
    expect(restored.currentUser()?.displayName).toBe('Alice');
  });

  it('only lets organisers create a Secret Santa', async () => {
    await as('carol');
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
    await as('alice');
    expect(await backend.canOrganize()).toBe(true);
  });

  it('runs the full flow: join, wishes, close, exclusions, automatic draw', async () => {
    // Empty organiser list: anyone may organise.
    storage.setItem(MOCK_STORAGE_KEY, JSON.stringify({ ...createSeed(), organizers: [] }));
    backend = new MockBackend(storage, 0);
    const zoe = await backend.signUpAsOrganizer('Zoe', 'noel');
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

    for (const who of ['alice', 'bob', 'carol']) {
      await as(who);
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

    await as(zoe);
    expect(await backend.getParticipantEmails(eventId)).toHaveLength(4);
    await backend.closeRegistrations(eventId);
    await expect(backend.previewInvitation(token)).rejects.toThrow(/list is already closed/);
    const { participants } = await backend.getEvent(eventId);
    const id = (name: string) => participants.find((p) => p.displayName === name)!.id;

    // Zoe refuses Alice; Alice refuses Bob.
    expect(await backend.submitExclusions(eventId, [id('Alice')])).toEqual({
      everyoneConfirmed: false,
    });
    expect(await backend.getMyExclusions(eventId)).toEqual([id('Alice')]);
    await as('alice');
    expect(await backend.getMyExclusions(eventId)).toEqual([]);
    await expect(backend.submitExclusions(eventId, [id('Alice')])).rejects.toThrow(/yourself/);
    await expect(
      backend.submitExclusions(eventId, [id('Bob'), id('Carol'), id('Zoe')]),
    ).rejects.toThrow(/at least one/);
    await backend.submitExclusions(eventId, [id('Bob')]);
    await expect(backend.drawNames(eventId)).rejects.toThrow(/Waiting for 2/);

    await as('bob');
    await backend.submitExclusions(eventId, []);
    await as('carol');
    expect(await backend.submitExclusions(eventId, [])).toEqual({ everyoneConfirmed: true });
    await backend.drawNames(eventId);
    await expect(backend.drawNames(eventId)).rejects.toThrow(/already been drawn/);

    const receivers: string[] = [];
    for (const [who, refused] of [
      [zoe, 'Alice'],
      ['alice', 'Bob'],
      ['bob', null],
      ['carol', null],
    ] as const) {
      await as(who);
      const giftee = (await backend.getGiftee(eventId))!.participant;
      if (refused) expect(giftee.displayName).not.toBe(refused);
      receivers.push(giftee.id);
    }
    expect(new Set(receivers).size).toBe(4);
  });

  it('lets the organiser reopen the list or force the draw', async () => {
    await as('alice');
    await backend.closeRegistrations('e-family');
    await backend.submitExclusions('e-family', ['p-family-bob']);
    await backend.reopenRegistrations('e-family');
    expect(await backend.getMyExclusions('e-family')).toEqual([]);
    expect((await backend.getEvent('e-family')).event.status).toBe('open');

    await backend.closeRegistrations('e-family');
    await as('bob');
    await expect(backend.reopenRegistrations('e-family')).rejects.toThrow(/not allowed/);
    await expect(backend.drawNames('e-family')).rejects.toThrow(/Waiting/);
    await as('alice');
    await backend.drawNames('e-family');
    expect((await backend.getEvent('e-family')).event.status).toBe('drawn');
  });

  it('keeps wishes private and shares them with the Santa only', async () => {
    await as('carol');
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
    await as('alice');
    const giftee = await backend.getGiftee('e-office');
    expect(giftee?.participant.displayName).toBe('Carol');
    expect(giftee?.wishlist.map((w) => w.title)).toContain('Socks');
    await expect(backend.getMyQuestionnaire('p-office-carol')).rejects.toThrow(/not allowed/);

    await as('dave');
    await expect(backend.getEvent('e-office')).rejects.toThrow(/not found/);
  });

  it('lets Santa and giftee talk without revealing the Santa', async () => {
    await as('alice');
    await backend.sendMessage('e-office', 'p-office-carol', 'santa', 'Paperback?');
    await expect(backend.sendMessage('e-office', 'p-office-bob', 'santa', 'Fake')).rejects.toThrow(
      /not allowed/,
    );

    await as('carol');
    const thread = await backend.listMessages('e-office', 'p-office-carol');
    expect(thread.map((m) => m.body)).toEqual([
      'Ho ho ho ! Tu préfères les livres de poche ou les grands formats ?',
      'Paperback?',
    ]);
    expect(Object.keys(thread[0]).sort()).toEqual(['body', 'createdAt', 'fromSanta', 'id']);

    await as('bob');
    expect(await backend.listMessages('e-office', 'p-office-carol')).toEqual([]);
  });

  it('protects organiser-only actions', async () => {
    await as('bob');
    await expect(backend.removeParticipant('p-family-carol')).rejects.toBeInstanceOf(BackendError);
    await expect(backend.deleteEvent('e-family')).rejects.toThrow(/organiser/);
    await expect(backend.getParticipantEmails('e-family')).rejects.toThrow(/organiser/);

    await as('alice');
    await backend.removeParticipant('p-family-dave');
    await backend.deleteEvent('e-family');
    expect((await backend.listEvents()).map((e) => e.id)).not.toContain('e-family');
  });
});
