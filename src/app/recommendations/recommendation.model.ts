import { InjectionToken } from '@angular/core';
import { Questionnaire, WishlistItem } from '../core/models';

export interface RecommendationRequest {
  questionnaire: Questionnaire | null;
  wishlist: readonly WishlistItem[];
  budgetMin: number | null;
  budgetMax: number | null;
  currency: string;
  limit: number;
}

export interface GiftSuggestion {
  id: string;
  title: string;
  description: string;
  minPrice: number;
  maxPrice: number;
  /** Human-readable explanation of why the idea was suggested. */
  reasons: string[];
  /** Relative relevance; higher is better. Comparable across providers. */
  score: number;
  /** Identifier of the provider that produced the suggestion (e.g. `rules`). */
  source: string;
}

/**
 * A source of gift suggestions. The app ships with a deterministic rule-based provider; an
 * AI-backed provider can be added later by implementing this interface and registering it with
 * `{ provide: GIFT_RECOMMENDATION_PROVIDERS, useClass: MyProvider, multi: true }`.
 */
export interface GiftRecommendationProvider {
  readonly id: string;
  recommend(request: RecommendationRequest): Promise<GiftSuggestion[]>;
}

export const GIFT_RECOMMENDATION_PROVIDERS = new InjectionToken<GiftRecommendationProvider[]>(
  'GIFT_RECOMMENDATION_PROVIDERS',
);
