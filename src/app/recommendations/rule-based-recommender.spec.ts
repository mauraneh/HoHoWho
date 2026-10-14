import { EMPTY_QUESTIONNAIRE, Questionnaire, WishlistItem } from '../core/models';
import { GIFT_CATALOG } from './gift-catalog';
import { AVOID, GIFT_STYLES, INTERESTS } from './questionnaire-options';
import { RecommendationRequest } from './recommendation.model';
import { inferInterests, recommendGifts, RuleBasedRecommender } from './rule-based-recommender';

function request(overrides: Partial<RecommendationRequest> = {}, q: Partial<Questionnaire> = {}) {
  return {
    questionnaire: { ...EMPTY_QUESTIONNAIRE, ...q },
    wishlist: [],
    budgetMin: null,
    budgetMax: null,
    currency: 'EUR',
    limit: 6,
    ...overrides,
  } satisfies RecommendationRequest;
}

function wish(title: string, notes = ''): WishlistItem {
  return {
    id: title,
    participantId: 'p',
    title,
    url: null,
    notes,
    price: null,
    priority: 2,
    createdAt: '',
  };
}

describe('recommendGifts', () => {
  it('ranks ideas matching declared interests first', () => {
    const result = recommendGifts(request({}, { interests: ['coffee'] }));
    expect(result.length).toBeGreaterThan(0);
    expect(GIFT_CATALOG.find((g) => g.id === result[0].id)!.interests).toContain('coffee');
    expect(result[0].reasons[0]).toContain('Café');
  });

  it('never suggests ideas conflicting with what to avoid', () => {
    const result = recommendGifts(
      request({ limit: 50 }, { interests: ['wine', 'coffee'], avoid: ['alcohol', 'caffeine'] }),
    );
    const ids = result.map((r) => r.id);
    expect(ids).not.toContain('wine-tasting');
    expect(ids).not.toContain('craft-beer');
    expect(ids).not.toContain('specialty-coffee');
    expect(ids).toContain('pour-over');
  });

  it('never exceeds the maximum budget', () => {
    const result = recommendGifts(
      request({ budgetMax: 20, limit: 50 }, { interests: ['music', 'wellness'] }),
    );
    expect(result.length).toBeGreaterThan(0);
    for (const suggestion of result) {
      expect(suggestion.minPrice).toBeLessThanOrEqual(20);
      expect(suggestion.maxPrice).toBeLessThanOrEqual(20);
    }
    expect(result.map((r) => r.id)).not.toContain('concert-tickets');
  });

  it('rewards preferred gift styles', () => {
    const result = recommendGifts(
      request({}, { interests: ['music'], giftStyles: ['experience'] }),
    );
    expect(result[0].id).toBe('concert-tickets');
  });

  it('infers interests from notes and wishlist text', () => {
    const result = recommendGifts(
      request({ wishlist: [wish('A new mystery novel')] }, { notes: 'My dog is my best friend' }),
    );
    const reasons = result.flatMap((r) => r.reasons).join(' ');
    expect(reasons).toContain('Lecture');
    expect(reasons).toContain('Animaux');
  });

  it('falls back to versatile ideas within budget when there are no answers', () => {
    const result = recommendGifts({ ...request({ budgetMax: 15 }), questionnaire: null });
    expect(result).toHaveLength(6);
    expect(result.every((r) => r.reasons.some((x) => x.includes('Valeur sûre')))).toBe(true);
  });

  it('is deterministic', () => {
    const input = request(
      { budgetMin: 10, budgetMax: 40, limit: 10 },
      { interests: ['tech', 'travel'], giftStyles: ['practical'] },
    );
    expect(recommendGifts(input)).toEqual(recommendGifts(input));
  });

  it('honours the limit', () => {
    expect(recommendGifts(request({ limit: 2 }, { interests: ['reading'] }))).toHaveLength(2);
  });

  it('exposes a provider implementation', async () => {
    const provider = new RuleBasedRecommender();
    expect(provider.id).toBe('rules');
    const result = await provider.recommend(request({}, { interests: ['tea'] }));
    expect(result.every((r) => r.source === 'rules')).toBe(true);
  });
});

describe('inferInterests', () => {
  it('understands French notes, accents included', () => {
    expect(inferInterests(['J’adore les romans, la pâtisserie et mon chat'], [])).toEqual([
      'reading',
      'baking',
      'pets',
    ]);
  });

  it('ignores interests already declared', () => {
    expect(inferInterests(['I love coffee and books'], ['coffee'])).toEqual(['reading']);
  });
});

describe('gift catalog', () => {
  const known = new Set([...INTERESTS, ...GIFT_STYLES, ...AVOID].map((o) => o.id));

  it('only references known questionnaire options', () => {
    for (const idea of GIFT_CATALOG) {
      for (const tag of [...idea.interests, ...idea.styles, ...idea.contains]) {
        expect(known.has(tag), `${idea.id}: ${tag}`).toBe(true);
      }
      expect(idea.minPrice).toBeLessThanOrEqual(idea.maxPrice);
    }
  });

  it('has unique ids', () => {
    expect(new Set(GIFT_CATALOG.map((g) => g.id)).size).toBe(GIFT_CATALOG.length);
  });

  it('covers every interest', () => {
    for (const interest of INTERESTS) {
      expect(
        GIFT_CATALOG.some((g) => g.interests.includes(interest.id)),
        interest.id,
      ).toBe(true);
    }
  });
});
