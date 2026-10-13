/** Answer choices offered in the participant questionnaire and understood by the recommender. */
export interface Option {
  id: string;
  label: string;
}

export const INTERESTS: readonly Option[] = [
  { id: 'reading', label: 'Reading' },
  { id: 'cooking', label: 'Cooking' },
  { id: 'baking', label: 'Baking' },
  { id: 'coffee', label: 'Coffee' },
  { id: 'tea', label: 'Tea' },
  { id: 'wine', label: 'Wine & spirits' },
  { id: 'gaming', label: 'Video games' },
  { id: 'board-games', label: 'Board games & puzzles' },
  { id: 'music', label: 'Music' },
  { id: 'movies', label: 'Movies & series' },
  { id: 'sports', label: 'Sports' },
  { id: 'fitness', label: 'Fitness & yoga' },
  { id: 'outdoors', label: 'Hiking & outdoors' },
  { id: 'travel', label: 'Travel' },
  { id: 'plants', label: 'Plants & gardening' },
  { id: 'art', label: 'Drawing & painting' },
  { id: 'crafts', label: 'Crafts & DIY' },
  { id: 'photography', label: 'Photography' },
  { id: 'tech', label: 'Tech & gadgets' },
  { id: 'fashion', label: 'Fashion & accessories' },
  { id: 'wellness', label: 'Self-care & wellness' },
  { id: 'pets', label: 'Pets' },
  { id: 'home', label: 'Home & decoration' },
  { id: 'kids', label: 'Family & kids' },
];

export const GIFT_STYLES: readonly Option[] = [
  { id: 'practical', label: 'Practical, something I will use' },
  { id: 'experience', label: 'An experience or activity' },
  { id: 'consumable', label: 'Something to eat or drink' },
  { id: 'cosy', label: 'Cosy & comforting' },
  { id: 'fun', label: 'Fun & playful' },
  { id: 'handmade', label: 'Handmade or personal' },
  { id: 'eco', label: 'Sustainable / zero waste' },
];

export const AVOID: readonly Option[] = [
  { id: 'alcohol', label: 'Alcohol' },
  { id: 'sweets', label: 'Sweets & chocolate' },
  { id: 'caffeine', label: 'Caffeine' },
  { id: 'nuts', label: 'Nuts' },
  { id: 'fragrance', label: 'Perfume & scented products' },
  { id: 'clothing', label: 'Clothing' },
  { id: 'clutter', label: 'Decorative objects / clutter' },
  { id: 'plastic', label: 'Plastic items' },
];

const ALL = new Map([...INTERESTS, ...GIFT_STYLES, ...AVOID].map((o) => [o.id, o.label]));

export function optionLabel(id: string): string {
  return ALL.get(id) ?? id;
}
