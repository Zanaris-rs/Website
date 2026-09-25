/**
 * The timeline's filter buttons: Everything, or one kind of entry. The
 * choice is `?show=<slug>` on the log's URL (so a filtered view can be
 * shared) and on "Older adventures", and the database does the filtering,
 * so paging works: `mask` is migration 15's `p_show` - bit n shows
 * adventure category n (`categories.ts`), bit 8 shows updates, and null
 * shows everything. It narrows what the owner's hidden categories allow;
 * it never shows more.
 *
 * Pure and client-safe.
 */

export type Filter = {
  slug: "all" | "posts" | "levels" | "quests" | "drops" | "clues";
  label: string;
  mask: number | null;
};

/** `p_show`'s bit for updates, above the eight adventure categories. */
const POSTS = 256;

/** The bits that are adventure categories, as `hidden_categories` has them. */
const CATEGORY_BITS = 255;

export const FILTERS: readonly Filter[] = [
  { slug: "all", label: "Everything", mask: null },
  { slug: "posts", label: "Posts", mask: POSTS },
  { slug: "levels", label: "Levels", mask: (1 << 1) | (1 << 2) },
  { slug: "quests", label: "Quests", mask: 1 << 3 },
  { slug: "drops", label: "Drops", mask: 1 << 4 },
  { slug: "clues", label: "Clues", mask: 1 << 5 },
];

const EVERYTHING = FILTERS[0];

/** The filter `?show=` names; Everything for none, or one it does not know. */
export function filterOf(slug: string | null | undefined): Filter {
  return FILTERS.find((filter) => filter.slug === slug) ?? EVERYTHING;
}

/**
 * The buttons worth showing on a log whose owner hides `hiddenMask`: a
 * filter for kinds of adventure is left out when every kind it is for is
 * hidden, since it could only ever say "Nothing here yet." Everything and
 * Posts always stay.
 */
export function visibleFilters(hiddenMask: number): Filter[] {
  return FILTERS.filter((filter) => {
    const categories = (filter.mask ?? 0) & CATEGORY_BITS;
    return categories === 0 || (categories & ~hiddenMask) !== 0;
  });
}

/** Whether the filter shows updates, and so the pinned one and the post box. */
export function showsPosts(filter: Filter): boolean {
  return filter.mask === null || (filter.mask & POSTS) !== 0;
}
