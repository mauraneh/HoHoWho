import { GIFT_CATALOG, GiftIdea } from './gift-catalog';
import { optionLabel } from './questionnaire-options';
import {
  GiftRecommendationProvider,
  GiftSuggestion,
  RecommendationRequest,
} from './recommendation.model';

/** Words in free-text answers and wishlist items that hint at an interest. */
const INTEREST_KEYWORDS: Record<string, readonly string[]> = {
  reading: [
    'book',
    'books',
    'novel',
    'novels',
    'read',
    'reading',
    'kindle',
    'poetry',
    'livre',
    'livres',
    'roman',
    'romans',
    'lire',
    'lecture',
    'bd',
    'manga',
    'mangas',
    'polar',
    'polars',
    'poesie',
  ],
  cooking: [
    'cook',
    'cooking',
    'kitchen',
    'recipe',
    'recipes',
    'chef',
    'cuisine',
    'cuisiner',
    'recette',
    'recettes',
  ],
  baking: [
    'bake',
    'baking',
    'bread',
    'cake',
    'pastry',
    'patisserie',
    'gateau',
    'gateaux',
    'pain',
    'biscuits',
  ],
  coffee: ['coffee', 'espresso', 'latte', 'cafe', 'expresso'],
  tea: ['tea', 'matcha', 'infusion', 'tisane', 'tisanes', 'infusions'],
  wine: [
    'wine',
    'beer',
    'whisky',
    'whiskey',
    'cocktail',
    'gin',
    'vin',
    'vins',
    'biere',
    'bieres',
    'rhum',
    'champagne',
    'cocktails',
  ],
  gaming: [
    'game',
    'gaming',
    'console',
    'playstation',
    'xbox',
    'nintendo',
    'switch',
    'gamer',
    'gameuse',
  ],
  'board-games': [
    'puzzle',
    'puzzles',
    'boardgame',
    'chess',
    'cards',
    'societe',
    'echecs',
    'cartes',
  ],
  music: [
    'music',
    'vinyl',
    'concert',
    'guitar',
    'piano',
    'headphones',
    'musique',
    'vinyle',
    'vinyles',
    'concerts',
    'guitare',
    'casque',
  ],
  movies: ['movie', 'movies', 'film', 'films', 'cinema', 'series', 'serie', 'netflix'],
  sports: [
    'football',
    'soccer',
    'rugby',
    'tennis',
    'basketball',
    'cycling',
    'running',
    'foot',
    'velo',
    'course',
    'basket',
    'sport',
  ],
  fitness: ['yoga', 'gym', 'fitness', 'workout', 'pilates', 'muscu', 'musculation'],
  outdoors: [
    'hiking',
    'hike',
    'camping',
    'climbing',
    'outdoor',
    'outdoors',
    'mountain',
    'rando',
    'randonnee',
    'montagne',
    'escalade',
    'nature',
  ],
  travel: [
    'travel',
    'trip',
    'trips',
    'luggage',
    'backpack',
    'voyage',
    'voyages',
    'voyager',
    'valise',
  ],
  plants: [
    'plant',
    'plants',
    'garden',
    'gardening',
    'succulent',
    'green',
    'flowers',
    'plante',
    'plantes',
    'jardin',
    'jardinage',
    'fleurs',
    'vert',
  ],
  art: [
    'drawing',
    'painting',
    'paint',
    'sketch',
    'art',
    'dessin',
    'dessiner',
    'peinture',
    'peindre',
    'aquarelle',
  ],
  crafts: [
    'knitting',
    'sewing',
    'craft',
    'crafts',
    'diy',
    'embroidery',
    'crochet',
    'tricot',
    'couture',
    'broderie',
  ],
  photography: ['photo', 'photos', 'camera', 'photography', 'photographie', 'appareil'],
  tech: [
    'tech',
    'gadget',
    'gadgets',
    'phone',
    'computer',
    'laptop',
    'smart',
    'geek',
    'telephone',
    'ordinateur',
    'informatique',
  ],
  fashion: [
    'fashion',
    'jewellery',
    'jewelry',
    'scarf',
    'bag',
    'style',
    'mode',
    'bijou',
    'bijoux',
    'sac',
    'echarpe',
  ],
  wellness: [
    'relax',
    'spa',
    'massage',
    'bath',
    'meditation',
    'self-care',
    'detente',
    'bain',
    'bien-etre',
  ],
  pets: [
    'dog',
    'dogs',
    'cat',
    'cats',
    'pet',
    'pets',
    'puppy',
    'kitten',
    'chien',
    'chiens',
    'chat',
    'chats',
    'animal',
    'animaux',
    'chiot',
    'chaton',
  ],
  home: [
    'home',
    'decor',
    'decoration',
    'candle',
    'blanket',
    'cosy',
    'cozy',
    'maison',
    'deco',
    'bougie',
    'bougies',
    'plaid',
    'cocooning',
  ],
  kids: [
    'kids',
    'children',
    'family',
    'son',
    'daughter',
    'enfants',
    'enfant',
    'famille',
    'fils',
    'fille',
  ],
};

const WEIGHT_DECLARED_INTEREST = 3;
const WEIGHT_INFERRED_INTEREST = 2;
const WEIGHT_STYLE = 2;
const WEIGHT_BUDGET_FIT = 1;

/** Lower-cased words without accents ("Pâtisserie" → "patisserie"). */
function words(text: string): Set<string> {
  const plain = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return new Set(plain.split(/[^a-z0-9-]+/).filter(Boolean));
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
      reasons.push(`Aime : ${declaredMatches.map(optionLabel).join(', ')}`);
    }
    if (inferredMatches.length) {
      reasons.push(
        `En parle dans ses notes ou sa liste : ${inferredMatches.map(optionLabel).join(', ')}`,
      );
    }
    if (styleMatches.length) {
      reasons.push(`Aime les cadeaux : ${styleMatches.map(optionLabel).join(', ')}`);
    }

    if (hasPreferences && score === 0) continue;

    const fitsBudget =
      (budgetMin === null || idea.maxPrice >= budgetMin) &&
      (budgetMax === null || idea.minPrice <= budgetMax);
    if (fitsBudget && (budgetMin !== null || budgetMax !== null)) {
      score += WEIGHT_BUDGET_FIT;
      reasons.push('Dans le budget');
    }
    if (!hasPreferences) {
      // Without answers, favour versatile ideas that suit many interests and styles.
      score += idea.interests.length + idea.styles.length;
      reasons.push('Valeur sûre (pas encore de réponses)');
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
