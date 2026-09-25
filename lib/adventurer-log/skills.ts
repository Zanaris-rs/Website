import type { PlayerSkill } from "@/lib/hiscores/api";
import { CATEGORIES, OVERALL } from "@/lib/hiscores/categories";

/**
 * The Skills box's own shape of a player's hiscores: one row per skill,
 * Overall on its own, and the range of combat levels consistent with what is
 * (and is not) on the hiscores.
 *
 * Hiscore rows only exist once a skill's base level reaches 15
 * (`buildHiscoreRows` on the engine side), so a skill below that is not a
 * "level 3" row to read - it is simply missing from `skills`. Everything here
 * treats that absence as `ranked: null` rather than guessing a level.
 * `combatRange` is the one place that has to guess anyway: it works out the
 * lowest and highest combat level a missing skill could still mean.
 */

export type SkillRow = {
  category: number;
  name: string;
  ranked: { level: number; xp: number; rank: number } | null;
};

/** Every skill category in `CATEGORIES` order, Overall left out: 19 rows, always. */
export function skillRows(skills: readonly PlayerSkill[]): SkillRow[] {
  const byCategory = new Map(skills.map((skill) => [skill.category, skill]));
  return CATEGORIES.filter((category) => category.id !== OVERALL).map((category) => {
    const skill = byCategory.get(category.id);
    return {
      category: category.id,
      name: category.name,
      ranked: skill ? { level: skill.level, xp: skill.xp, rank: skill.rank } : null,
    };
  });
}

/** Overall's row, or `null` before the player's total level reaches the hiscores. */
export function overallOf(skills: readonly PlayerSkill[]): { level: number; xp: number; rank: number } | null {
  const overall = skills.find((skill) => skill.category === OVERALL);
  return overall ? { level: overall.level, xp: overall.xp, rank: overall.rank } : null;
}

// --- combat level ------------------------------------------------------

/**
 * The seven hiscore categories `Player.getCombatLevel` reads, by the ids
 * `lib/hiscores/categories.ts` gives them - one higher than the engine's own
 * `PlayerStat` index, the offset every hiscore category carries.
 */
const ATTACK = 1;
const DEFENCE = 2;
const STRENGTH = 3;
const HITPOINTS = 4;
const RANGED = 5;
const PRAYER = 6;
const MAGIC = 7;

const COMBAT_CATEGORIES: readonly number[] = [ATTACK, DEFENCE, STRENGTH, HITPOINTS, RANGED, PRAYER, MAGIC];

/**
 * A base level nobody has ranked yet. Every stat starts at 1 except
 * Hitpoints, which starts at 10 - the one exception a caller of
 * `getCombatLevel` has to know about - and a hiscore row would exist by 15,
 * so 14 is as high as an unranked stat can be either way.
 */
const UNRANKED_LOW: Readonly<Record<number, number>> = {
  [ATTACK]: 1,
  [DEFENCE]: 1,
  [STRENGTH]: 1,
  [HITPOINTS]: 10,
  [RANGED]: 1,
  [PRAYER]: 1,
  [MAGIC]: 1,
};
const UNRANKED_HIGH = 14;

/**
 * `Player.getCombatLevel` in `engine/src/engine/entity/Player.ts`, copied
 * rather than shared: the engine is not something this website builds
 * against, so this is the one place here that has to stay in step with it by
 * hand. `level` is keyed by the same seven category ids as `COMBAT_CATEGORIES`.
 */
function combatLevelOf(level: Readonly<Record<number, number>>): number {
  const base = 0.25 * (level[DEFENCE] + level[HITPOINTS] + Math.floor(level[PRAYER] / 2));
  const melee = 0.325 * (level[ATTACK] + level[STRENGTH]);
  const range = 0.325 * (Math.floor(level[RANGED] / 2) + level[RANGED]);
  const magic = 0.325 * (Math.floor(level[MAGIC] / 2) + level[MAGIC]);
  return Math.floor(base + Math.max(melee, range, magic));
}

/**
 * The combat level's range: exact (`min === max`) once all seven combat
 * skills are on the hiscores, otherwise the lowest and highest level
 * consistent with what is missing. Every term `combatLevelOf` adds grows (or
 * stays the same) as any one stat does, so plugging every unranked stat's low
 * end in at once gives the true minimum, and its high end at once the true
 * maximum - no combination in between could land outside this range.
 */
export function combatRange(skills: readonly PlayerSkill[]): { min: number; max: number } {
  const known = new Map(skills.map((skill) => [skill.category, skill.level]));
  const low: Record<number, number> = {};
  const high: Record<number, number> = {};
  for (const category of COMBAT_CATEGORIES) {
    const level = known.get(category);
    low[category] = level ?? UNRANKED_LOW[category];
    high[category] = level ?? UNRANKED_HIGH;
  }
  return { min: combatLevelOf(low), max: combatLevelOf(high) };
}
