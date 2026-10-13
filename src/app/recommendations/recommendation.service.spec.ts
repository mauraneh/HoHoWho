import { TestBed } from '@angular/core/testing';
import {
  GIFT_RECOMMENDATION_PROVIDERS,
  GiftRecommendationProvider,
  GiftSuggestion,
  RecommendationRequest,
} from './recommendation.model';
import { RecommendationService } from './recommendation.service';
import { RuleBasedRecommender } from './rule-based-recommender';

const request: RecommendationRequest = {
  questionnaire: { interests: ['tea'], giftStyles: [], avoid: [], sizes: '', notes: '' },
  wishlist: [],
  budgetMin: null,
  budgetMax: null,
  currency: 'EUR',
  limit: 5,
};

class FailingProvider implements GiftRecommendationProvider {
  readonly id = 'failing';
  recommend(): Promise<GiftSuggestion[]> {
    return Promise.reject(new Error('offline'));
  }
}

class ExtraProvider implements GiftRecommendationProvider {
  readonly id = 'extra';
  recommend(): Promise<GiftSuggestion[]> {
    return Promise.resolve([
      {
        id: 'x',
        title: 'Tea ceremony',
        description: '',
        minPrice: 1,
        maxPrice: 2,
        reasons: [],
        score: 100,
        source: 'extra',
      },
    ]);
  }
}

describe('RecommendationService', () => {
  it('merges providers and survives a failing one', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    TestBed.configureTestingModule({
      providers: [
        { provide: GIFT_RECOMMENDATION_PROVIDERS, useClass: RuleBasedRecommender, multi: true },
        { provide: GIFT_RECOMMENDATION_PROVIDERS, useClass: FailingProvider, multi: true },
        { provide: GIFT_RECOMMENDATION_PROVIDERS, useClass: ExtraProvider, multi: true },
      ],
    });
    const result = await TestBed.inject(RecommendationService).recommend(request);
    expect(result[0].source).toBe('extra');
    expect(result.some((r) => r.source === 'rules')).toBe(true);
    expect(result.length).toBeLessThanOrEqual(5);
  });
});
