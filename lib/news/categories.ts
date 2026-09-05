import type { Colour } from "@/lib/colour";

/**
 * The six news categories, in the order the filter line lists them.
 *
 * The colours are the original's own link classes — a category is recognised
 * by its colour before it is read, which is the whole point of the filter
 * line. `slug` is what appears in a URL; `name` is what a post's frontmatter
 * has to say verbatim.
 */
export type NewsCategory = {
  name: string;
  slug: string;
  style: Colour;
};

export const CATEGORIES: NewsCategory[] = [
  { name: "Game Updates", slug: "game-updates", style: "red" },
  { name: "Website", slug: "website", style: "lblue" },
  { name: "Customer Support", slug: "customer-support", style: "yellow" },
  { name: "Technical", slug: "technical", style: "dblue" },
  { name: "Community", slug: "community", style: "green" },
  { name: "Behind the Scenes", slug: "behind-the-scenes", style: "purple" },
];

export const CATEGORY_NAMES: string[] = CATEGORIES.map(
  (category) => category.name,
);

/** The category a post's frontmatter names, or `undefined` if it is not one. */
export function categoryByName(name: string): NewsCategory | undefined {
  return CATEGORIES.find((category) => category.name === name);
}

/** The category a `/news/category/<slug>` URL names. */
export function categoryBySlug(slug: string): NewsCategory | undefined {
  return CATEGORIES.find((category) => category.slug === slug);
}
