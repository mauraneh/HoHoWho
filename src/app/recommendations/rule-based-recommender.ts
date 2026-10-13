import { GIFT_CATALOG, GiftIdea } from './gift-catalog';
import { optionLabel } from './questionnaire-options';
import {
  GiftRecommendationProvider,
  GiftSuggestion,
  RecommendationRequest,
} from './recommendation.model';

/** Words in free-text answers and wishlist items that hint at an interest. */
const INTEREST_KEYWORDS: Record<string, readonly string[]> = {
  reading: ['book', 'books', 'novel', 'novels', 'read', 'reading', 'kindle', 'poetry'],
  cooking: ['cook', 'cooking', 'kitchen', 'recipe', 'recipes', 'chef'],
  baking: ['bake', 'baking', 'bread', 'cake', 'pastry'],
  coffee: ['coffee', 'espresso', 'latte'],
  tea: ['tea', 'matcha', 'infusion'],
  wine: ['wine', 'beer', 'whisky', 'whiskey', 'cocktail', 'gin'],
  gaming: ['game', 'gaming', 'console', 'playstation', 'xbox', 'nintendo', 'switch'],
  'board-games': ['puzzle', 'puzzles', 'boardgame', 'chess', 'cards'],
  music: ['music', 'vinyl', 'concert', 'guitar', 'piano', 'headphones'],
  movies: ['movie', 'movies', 'film', 'films', 'cinema', 'series'],
  sports: ['football', 'soccer', 'rugby', 'tennis', 'basketball', 'cycling', 'running'],
  fitness: ['yoga', 'gym', 'fitness', 'workout', 'pilates'],
  outdoors: ['hiking', 'hike', 'camping', 'climbing', 'outdoor', 'outdoors', 'mountain'],
  travel: ['travel', 'trip', 'trips', 'luggage', 'backpack'],
  plants: ['plant', 'plants', 'garden', 'gardening', 'succulent', 'green', 'flowers'],
  art: ['drawing', 'painting', 'paint', 'sketch', 'art'],
  crafts: ['knitting', 'sewing', 'craft', 'crafts', 'diy', 'embroidery', 'crochet'],
  photography: ['photo', 'photos', 'camera', 'photography'],
  tech: ['tech', 'gadget', 'gadgets', 'phone', 'computer', 'laptop', 'smart'],
  fashion: ['fashion', 'jewellery', 'jewelry', 'scarf', 'bag', 'style'],
  wellness: ['relax', 'spa', 'massage', 'bath', 'meditation', 'self-care'],
  pets: ['dog', 'dogs', 'cat', 'cats', 'pet', 'pets', 'puppy', 'kitten'],
  home: ['home', 'decor', 'decoration', 'candle', 'blanket', 'cosy', 'cozy'],
  kids: ['kids', 'children', 'family', 'son', 'daughter'],
};

const WEIGHT_DECLARED_INTEREST = 3;
const WEIGHT_INFERRED_INTEREST = 2;
const WEIGHT_STYLE = 2;
const WEIGHT_BUDGET_FIT = 1;

function words(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9-]+/)
      .filter(Boolean),
  );
}

/** Interests mentioned in free text (notes, sizes, wishlist) but not ticked explicitly. */
export function inferInterests(texts: readonly string[], declared: readonly string[]): string[] {
  const vocabulary = words(texts.join(' '));
  return Object.entries(INTEREST_KEYWORDS)
    .filter(([id, keywords]) => !declared.includes(id) && keywords.some((k) => vocabulary.has(k)))
    .map(([id]) => id);
}

/**
 * Deterministic recommender: scores catalog ideas against the giftee's questionnaire,
 * wishlist and the event budget. Same input always yields the same output.
 */
export function recommendGifts(
  request: RecommendationRequest,
  catalog: readonly GiftIdea[] = GIFT_CATALOG,
): GiftSuggestion[] {
  const q = request.questionnaire;
  const declared = q?.interests ?? [];
  const styles = q?.giftStyles ?? [];
  const avoid = new Set(q?.avoid ?? []);
  const inferred = inferInterests(
    [q?.notes ?? '', ...request.wishlist.flatMap((w) => [w.title, w.notes])],
    declared,
  );
  const hasPreferences = declared.length + inferred.length + styles.length > 0;
  const { budgetMin, budgetMax } = request;

  const scored: GiftSuggestion[] = [];
  for (const idea of catalog) {
    // Hard rules: respect exclusions and never exceed the budget.
    if (idea.contains.some((c) => avoid.has(c))) continue;
    if (budgetMax !== null && idea.minPrice > budgetMax) continue;

    let score = 0;
    const reasons: string[] = [];

    const declaredMatches = idea.interests.filter((i) => declared.includes(i));
    const inferredMatches = idea.interests.filter((i) => inferred.includes(i));
    const styleMatches = idea.styles.filter((s) => styles.includes(s));

    score += declaredMatches.length * WEIGHT_DECLARED_INTEREST;
    score += inferredMatches.length * WEIGHT_INFERRED_INTEREST;
    score += styleMatches.length * WEIGHT_STYLE;
    if (declaredMatches.length) {
      reasons.push(`Interested in ${declaredMatches.map(optionLabel).join(', ').toLowerCase()}`);
    }
    if (inferredMatches.length) {
      reasons.push(
        `Mentions ${inferredMatches.map(optionLabel).join(', ').toLowerCase()} in their notes or wishlist`,
      );
    }
    if (styleMatches.length) {
      reasons.push(
        `Likes gifts that are ${styleMatches.map(optionLabel).join(', ').toLowerCase()}`,
      );
    }

    if (hasPreferences && score === 0) continue;

    const fitsBudget =
      (budgetMin === null || idea.maxPrice >= budgetMin) &&
      (budgetMax === null || idea.minPrice <= budgetMax);
    if (fitsBudget && (budgetMin !== null || budgetMax !== null)) {
      score += WEIGHT_BUDGET_FIT;
      reasons.push('Fits the event budget');
    }
    if (!hasPreferences) {
      // Without answers, favour versatile ideas that suit many interests and styles.
      score += idea.interests.length + idea.styles.length;
      reasons.push('Versatile choice (no questionnaire answers yet)');
    }

    scored.push({
      id: idea.id,
      title: idea.title,
      description: idea.description,
      minPrice: idea.minPrice,
      maxPrice: budgetMax === null ? idea.maxPrice : Math.min(idea.maxPrice, budgetMax),
      reasons,
      score,
      source: 'rules',
    });
  }

  return scored
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, Math.max(0, request.limit));
}

export class RuleBasedRecommender implements GiftRecommendationProvider {
  readonly id = 'rules';

  recommend(request: RecommendationRequest): Promise<GiftSuggestion[]> {
    return Promise.resolve(recommendGifts(request));
  }
}
