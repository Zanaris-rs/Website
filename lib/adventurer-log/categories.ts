/**
 * The kinds of adventure, as the login server files them
 * (engine `src/server/login/Adventure.ts`, `adventure_event.category`). The
 * owner's hidden categories are a bitmask over these ids: bit n hides n.
 */

export type AdventureCategory = {
  readonly id: number;
  /** The CSS class suffix: `.al-event--<slug>`. */
  readonly slug: string;
  readonly label: string;
};

export const ADVENTURE_CATEGORIES: readonly AdventureCategory[] = [
  { id: 1, slug: "level", label: "Levels gained" },
  { id: 2, slug: "milestone", label: "Total level milestones" },
  { id: 3, slug: "quest", label: "Quests completed" },
  { id: 4, slug: "drop", label: "Rare drops" },
  { id: 5, slug: "clue", label: "Clue scrolls" },
  { id: 6, slug: "random", label: "Random events" },
  { id: 7, slug: "tutorial", label: "Tutorial Island" },
  { id: 0, slug: "other", label: "Everything else" },
];

const BY_ID = new Map(ADVENTURE_CATEGORIES.map((category) => [category.id, category]));

export function categorySlug(id: number): string {
  return BY_ID.get(id)?.slug ?? "other";
}

export const HIDDEN_MASK_MAX = 255;

export function isHidden(mask: number, id: number): boolean {
  return (mask & (1 << id)) !== 0;
}

/** The mask for a set of hidden category ids. */
export function maskOf(hidden: Iterable<number>): number {
  let mask = 0;
  for (const id of hidden) {
    if (BY_ID.has(id)) mask |= 1 << id;
  }
  return mask;
}
