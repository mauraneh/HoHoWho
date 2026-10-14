/** Answer choices offered in the participant questionnaire and understood by the recommender. */
export interface Option {
  id: string;
  label: string;
}

export const INTERESTS: readonly Option[] = [
  { id: 'reading', label: 'Lecture' },
  { id: 'cooking', label: 'Cuisine' },
  { id: 'baking', label: 'Pâtisserie' },
  { id: 'coffee', label: 'Café' },
  { id: 'tea', label: 'Thé' },
  { id: 'wine', label: 'Vins & spiritueux' },
  { id: 'gaming', label: 'Jeux vidéo' },
  { id: 'board-games', label: 'Jeux de société & puzzles' },
  { id: 'music', label: 'Musique' },
  { id: 'movies', label: 'Films & séries' },
  { id: 'sports', label: 'Sport' },
  { id: 'fitness', label: 'Fitness & yoga' },
  { id: 'outdoors', label: 'Randonnée & plein air' },
  { id: 'travel', label: 'Voyages' },
  { id: 'plants', label: 'Plantes & jardinage' },
  { id: 'art', label: 'Dessin & peinture' },
  { id: 'crafts', label: 'Loisirs créatifs & DIY' },
  { id: 'photography', label: 'Photographie' },
  { id: 'tech', label: 'High-tech & gadgets' },
  { id: 'fashion', label: 'Mode & accessoires' },
  { id: 'wellness', label: 'Bien-être & soin de soi' },
  { id: 'pets', label: 'Animaux' },
  { id: 'home', label: 'Maison & déco' },
  { id: 'kids', label: 'Famille & enfants' },
];

export const GIFT_STYLES: readonly Option[] = [
  { id: 'practical', label: 'Pratique, que j’utiliserai' },
  { id: 'experience', label: 'Une expérience ou une activité' },
  { id: 'consumable', label: 'À manger ou à boire' },
  { id: 'cosy', label: 'Cocooning & réconfortant' },
  { id: 'fun', label: 'Fun & ludique' },
  { id: 'handmade', label: 'Fait main ou personnalisé' },
  { id: 'eco', label: 'Durable / zéro déchet' },
];

export const AVOID: readonly Option[] = [
  { id: 'alcohol', label: 'Alcool' },
  { id: 'sweets', label: 'Sucreries & chocolat' },
  { id: 'caffeine', label: 'Caféine' },
  { id: 'nuts', label: 'Fruits à coque' },
  { id: 'fragrance', label: 'Parfums & produits parfumés' },
  { id: 'clothing', label: 'Vêtements' },
  { id: 'clutter', label: 'Objets déco / bibelots' },
  { id: 'plastic', label: 'Objets en plastique' },
];

const ALL = new Map([...INTERESTS, ...GIFT_STYLES, ...AVOID].map((o) => [o.id, o.label]));

export function optionLabel(id: string): string {
  return ALL.get(id) ?? id;
}
