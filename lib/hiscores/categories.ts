/**
 * The twenty hiscore categories, and the mapping to the rows behind them.
 *
 * Category 0 is Overall and comes from `hiscores.hiscore_large_public` (the
 * only `type` in that table is 0). Every other category is a skill and comes
 * from `hiscores.hiscore_public` with `type` equal to the category id, which
 * is the engine's `PlayerStat` index plus one. 19 and 20 are disabled stats
 * and never appear, which is why the list jumps from 18 to 21.
 */

export type Category = {
  readonly id: number;
  readonly name: string;
};

export const OVERALL = 0;

export const CATEGORIES: readonly Category[] = [
  { id: 0, name: "Overall" },
  { id: 1, name: "Attack" },
  { id: 2, name: "Defence" },
  { id: 3, name: "Strength" },
  { id: 4, name: "Hitpoints" },
  { id: 5, name: "Ranged" },
  { id: 6, name: "Prayer" },
  { id: 7, name: "Magic" },
  { id: 8, name: "Cooking" },
  { id: 9, name: "Woodcutting" },
  { id: 10, name: "Fletching" },
  { id: 11, name: "Fishing" },
  { id: 12, name: "Firemaking" },
  { id: 13, name: "Crafting" },
  { id: 14, name: "Smithing" },
  { id: 15, name: "Mining" },
  { id: 16, name: "Herblore" },
  { id: 17, name: "Agility" },
  { id: 18, name: "Thieving" },
  { id: 21, name: "Runecrafting" },
];

const BY_ID = new Map(CATEGORIES.map((category) => [category.id, category]));

export function isCategory(id: number): boolean {
  return BY_ID.has(id);
}

/** `null` rather than a throw: callers turn this into a 400. */
export function categoryName(id: number): string | null {
  return BY_ID.get(id)?.name ?? null;
}
