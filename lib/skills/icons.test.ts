import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { CATEGORIES, OVERALL } from "../hiscores/categories";
import { SKILLS, skillIconSrc, statOfCategory } from "./icons";

const PUBLIC = path.join(__dirname, "../../public");

describe("skillIconSrc", () => {
  it("finds attack and runecraft by stat id", () => {
    expect(skillIconSrc(0)).toBe("/img/game/skills/0.png");
    expect(skillIconSrc(20)).toBe("/img/game/skills/20.png");
  });

  it("has nothing for the two stats 2004 never shipped", () => {
    expect(skillIconSrc(18)).toBeNull();
    expect(skillIconSrc(19)).toBeNull();
  });

  it("has a file for every skill and no others", () => {
    for (const skill of SKILLS) {
      expect(
        existsSync(path.join(PUBLIC, skillIconSrc(skill.id)!)),
        skill.name,
      ).toBe(true);
    }
    expect(readdirSync(path.join(PUBLIC, "img/game/skills")).length).toBe(
      SKILLS.length,
    );
  });
});

describe("statOfCategory", () => {
  it("is the stat id plus one, and nothing for Overall", () => {
    expect(statOfCategory(OVERALL)).toBeNull();
    expect(statOfCategory(1)).toBe(0); // Attack
    expect(statOfCategory(21)).toBe(20); // Runecrafting
    expect(statOfCategory(19)).toBeNull();
  });

  it("gives every hiscore skill table an icon of the same skill", () => {
    for (const category of CATEGORIES) {
      if (category.id === OVERALL) continue;
      const stat = statOfCategory(category.id);
      expect(stat, category.name).not.toBeNull();
      const skill = SKILLS.find((entry) => entry.id === stat)!;
      // "Runecrafting" on the hiscores, "Runecraft" in the stats tab.
      expect(category.name.startsWith(skill.name), category.name).toBe(true);
    }
  });
});
