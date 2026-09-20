import manifest from "./icons.json";

/**
 * Skill ids as icons.
 *
 * A skill id here is the engine's stat id (`PlayerStat` in
 * `engine/src/engine/entity/PlayerStat.ts`): 0 Attack to 17 Thieving, then
 * 20 Runecraft. 18 and 19 are stats the 2004 game never shipped. A hiscore
 * category is not a stat id — it is the stat id plus one, with 0 for Overall
 * — so convert with `statOfCategory` rather than using one as the other.
 *
 * `public/img/game/skills/<stat>.png` is the 25x25 sprite the stats tab draws
 * for that skill, taken out of the engine's pack by
 * `scripts/update-game-icons.sh`.
 */

export type Skill = {
  readonly id: number;
  readonly name: string;
};

export const SKILLS: readonly Skill[] = [
  { id: 0, name: "Attack" },
  { id: 1, name: "Defence" },
  { id: 2, name: "Strength" },
  { id: 3, name: "Hitpoints" },
  { id: 4, name: "Ranged" },
  { id: 5, name: "Prayer" },
  { id: 6, name: "Magic" },
  { id: 7, name: "Cooking" },
  { id: 8, name: "Woodcutting" },
  { id: 9, name: "Fletching" },
  { id: 10, name: "Fishing" },
  { id: 11, name: "Firemaking" },
  { id: 12, name: "Crafting" },
  { id: 13, name: "Smithing" },
  { id: 14, name: "Mining" },
  { id: 15, name: "Herblore" },
  { id: 16, name: "Agility" },
  { id: 17, name: "Thieving" },
  { id: 20, name: "Runecraft" },
];

const STATS: ReadonlySet<number> = new Set(SKILLS.map((skill) => skill.id));

/**
 * The version the generator stamped on the skill icons — the same scheme as
 * `lib/items/icons.ts`, which explains it. The two sets are hashed apart, so
 * a regeneration that only moves an item model leaves these URLs, and the
 * caches holding them, untouched.
 */
const VERSION: string = manifest.version;

/** The icon's URL, or `null` for anything that is not a 2004 skill. */
export function skillIconSrc(stat: number): string | null {
  return STATS.has(stat) ? `/img/game/skills/${stat}.png?v=${VERSION}` : null;
}

/** The stat behind a hiscore category, or `null` for Overall and unknowns. */
export function statOfCategory(category: number): number | null {
  const stat = category - 1;
  return STATS.has(stat) ? stat : null;
}

/** Every icon is this square: the stats tab's cell. */
export const SKILL_ICON_SIZE = 25;
