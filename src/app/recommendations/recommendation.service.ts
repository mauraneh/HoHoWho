import { inject, Injectable } from '@angular/core';
import {
  GIFT_RECOMMENDATION_PROVIDERS,
  GiftSuggestion,
  RecommendationRequest,
} from './recommendation.model';

/** Aggregates suggestions from every registered provider. A failing provider never breaks the others. */
@Injectable({ providedIn: 'root' })
export class RecommendationService {
  private readonly providers = inject(GIFT_RECOMMENDATION_PROVIDERS);

  async recommend(request: RecommendationRequest): Promise<GiftSuggestion[]> {
    const results = await Promise.allSettled(this.providers.map((p) => p.recommend(request)));
    const merged = new Map<string, GiftSuggestion>();
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.warn(`Recommendation provider "${this.providers[index].id}" failed`, result.reason);
        return;
      }
      for (const suggestion of result.value) {
        const key = suggestion.title.toLowerCase();
        const existing = merged.get(key);
        if (!existing || existing.score < suggestion.score) merged.set(key, suggestion);
      }
    });
    return [...merged.values()]
      .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
      .slice(0, request.limit);
  }
}
