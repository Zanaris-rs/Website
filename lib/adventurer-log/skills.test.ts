import { describe, expect, it } from "vitest";

import { CATEGORIES, OVERALL } from "@/lib/hiscores/categories";
import type { PlayerSkill } from "@/lib/hiscores/api";

import { combatRange, overallOf, skillRows } from "./skills";

/**
 * `skills.ts` turns `PlayerSkill[]` - whatever categories happen to be on the
 * hiscores - into what the Skills box draws: one row per skill, Overall on
 * its own, and the combat level's range. The combat numbers below are worked
 * out by hand against `Player.getCombatLevel` in
 * `engine/src/engine/entity/Player.ts`; the tests assert those figures, not
 * this comment.
 */

describe("skillRows", () => {
  it("returns 19 rows in CATEGORIES order, Overall excluded", () => {
    const skills: PlayerSkill[] = [
      { category: 1, level: 99, xp: 130_000_000, rank: 42 },
      { category: 21, level: 60, xp: 500_000, rank: 900 },
    ];
    const rows = skillRows(skills);

    expect(rows.map((row) => row.category)).toEqual(
      CATEGORIES.filter((category) => category.id !== OVERALL).map((category) => category.id),
    );
    expect(rows.length).toBe(19);
  });

  it("marks a skill ranked when it is in the list, with its level, xp and rank", () => {
    const skills: PlayerSkill[] = [{ category: 1, level: 99, xp: 130_000_000, rank: 42 }];
    const attack = skillRows(skills).find((row) => row.category === 1);
    expect(attack).toEqual({
      category: 1,
      name: "Attack",
      ranked: { level: 99, xp: 130_000_000, rank: 42 },
    });
  });

  it("marks a skill missing from the list as unranked", () => {
    const defence = skillRows([]).find((row) => row.category === 2);
    expect(defence).toEqual({ category: 2, name: "Defence", ranked: null });
  });

  it("never includes Overall as one of the 19 rows", () => {
    const skills: PlayerSkill[] = [{ category: OVERALL, level: 500, xp: 1, rank: 1 }];
    expect(skillRows(skills).some((row) => row.category === OVERALL)).toBe(false);
  });
});

describe("overallOf", () => {
  it("reads Overall's row when the player has one", () => {
    const skills: PlayerSkill[] = [{ category: OVERALL, level: 513, xp: 1_234_567, rank: 45 }];
    expect(overallOf(skills)).toEqual({ level: 513, xp: 1_234_567, rank: 45 });
  });

  it("is null before Overall reaches the hiscores", () => {
    expect(overallOf([])).toBeNull();
  });
});

describe("combatRange", () => {
  it("gives an exact level once all seven combat skills are ranked", () => {
    const skills: PlayerSkill[] = [
      { category: 1, level: 60, xp: 0, rank: 1 }, // Attack
      { category: 2, level: 60, xp: 0, rank: 1 }, // Defence
      { category: 3, level: 60, xp: 0, rank: 1 }, // Strength
      { category: 4, level: 60, xp: 0, rank: 1 }, // Hitpoints
      { category: 5, level: 40, xp: 0, rank: 1 }, // Ranged
      { category: 6, level: 43, xp: 0, rank: 1 }, // Prayer
      { category: 7, level: 50, xp: 0, rank: 1 }, // Magic
    ];
    // base  = 0.25*(60+60+floor(43/2)) = 0.25*(60+60+21) = 0.25*141 = 35.25
    // melee = 0.325*(60+60)                                          = 39
    // range = 0.325*(floor(40/2)+40)   = 0.325*60                    = 19.5
    // magic = 0.325*(floor(50/2)+50)   = 0.325*75                    = 24.375
    // max(melee, range, magic) = 39; 35.25 + 39 = 74.25 -> floor 74
    expect(combatRange(skills)).toEqual({ min: 74, max: 74 });
  });

  it("gives the widest possible range when nothing is ranked", () => {
    // Low end - every stat at its unranked minimum (Hitpoints 10, the rest 1):
    // base  = 0.25*(1+10+floor(1/2)) = 0.25*11  = 2.75
    // melee = 0.325*(1+1)            = 0.65
    // range = magic = 0.325*(floor(1/2)+1) = 0.325
    // 2.75 + 0.65 = 3.4 -> floor 3
    //
    // High end - every stat at 14, Hitpoints included:
    // base  = 0.25*(14+14+floor(14/2)) = 0.25*35  = 8.75
    // melee = 0.325*(14+14)            = 9.1
    // range = magic = 0.325*(floor(14/2)+14) = 6.825
    // 8.75 + 9.1 = 17.85 -> floor 17
    expect(combatRange([])).toEqual({ min: 3, max: 17 });
  });

  it("ranges only over what is unranked, here just Prayer", () => {
    const skills: PlayerSkill[] = [
      { category: 1, level: 70, xp: 0, rank: 1 }, // Attack
      { category: 2, level: 40, xp: 0, rank: 1 }, // Defence
      { category: 3, level: 70, xp: 0, rank: 1 }, // Strength
      { category: 4, level: 50, xp: 0, rank: 1 }, // Hitpoints
      { category: 5, level: 15, xp: 0, rank: 1 }, // Ranged
      { category: 7, level: 15, xp: 0, rank: 1 }, // Magic
      // Prayer (6) is missing: under 15, not on the hiscores.
    ];
    // melee = 0.325*(70+70) = 45.5, which beats range = magic = 0.325*(7+15) = 7.15,
    // so only `base` moves with Prayer.
    // base(prayer=1)  = 0.25*(40+50+floor(1/2))  = 0.25*90  = 22.5;  22.5 + 45.5  = 68.0  -> floor 68
    // base(prayer=14) = 0.25*(40+50+floor(14/2)) = 0.25*97  = 24.25; 24.25 + 45.5 = 69.75 -> floor 69
    const range = combatRange(skills);
    expect(range).toEqual({ min: 68, max: 69 });
    expect(range.min).toBeLessThanOrEqual(range.max);
  });
});
