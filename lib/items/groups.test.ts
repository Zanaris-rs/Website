import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { GROUPS, OTHER_GROUP, groupIdMap, groupOf, groupRoster, ruleClaims, unclassifiedIds } from "./groups";
import { itemName } from "./names";
import { allItemIds, baseIdOf, debugName, isNote } from "./objects";

const map = groupIdMap();

/** The base objects of one group, as the page would name them. */
function members(key: string): string[] {
  return map[key]
    .filter((id) => !isNote(id))
    .map(itemName)
    .sort();
}

describe("the rules", () => {
  it("never let two of them claim the same object", () => {
    // Asserted over the rules and *not* over `groupOf`, which returns the first
    // match and so could never report two. A second claim would take an object
    // out of one block and put it in another with no test failing and nothing
    // on the page to notice.
    for (const id of allItemIds()) {
      const base = baseIdOf(id);
      const name = debugName(base);
      const claims = GROUPS.filter((group) => ruleClaims(group.rule, base, name)).map((group) => group.key);
      expect(claims.length, `${name} is claimed by ${claims.join(", ")}`).toBeLessThanOrEqual(1);
    }
  });

  it("put every object in exactly one place, group or residual", () => {
    const grouped = Object.values(map).flat();
    expect(new Set(grouped).size).toBe(grouped.length);
    expect(grouped.length + unclassifiedIds().length).toBe(allItemIds().length);
    expect(allItemIds()).toHaveLength(3883);
  });

  it("never name the residual group, which the SQL reserves", () => {
    expect(Object.keys(map)).not.toContain(OTHER_GROUP);
    expect(GROUPS.map((group) => group.key)).not.toContain(OTHER_GROUP);
  });

  it("keep a note wherever its base object is", () => {
    for (const id of allItemIds()) {
      if (!isNote(id)) continue;
      expect(groupOf(id), itemName(id)).toBe(groupOf(baseIdOf(id)));
    }
  });
});

describe("the traps the 2004 data lays", () => {
  const claimed = (name: string) => {
    const id = allItemIds().find((candidate) => debugName(candidate) === name);
    expect(id, `${name} is not in the object list any more`).toBeDefined();
    return groupOf(id!);
  };

  it("does not read `1dose2restore` as an ore", () => {
    // It ends in "ore". Every dose of every restore potion would join Ores.
    expect(claimed("1dose2restore")).not.toBe("ores");
    expect(claimed("iron_ore")).toBe("ores");
  });

  it("does not read `chocolate_bar` as a smithing bar", () => {
    expect(claimed("chocolate_bar")).not.toBe("bars");
    expect(claimed("steel_bar")).toBe("bars");
  });

  it("does not read the board game pieces as runes", () => {
    expect(claimed("boardgames_runelink_firerune")).not.toBe("runes");
    expect(claimed("firerune")).toBe("runes");
  });

  it("does not read `ground_bat_bones` as bones", () => {
    // A powdered secondary ingredient, not a bone anybody buries.
    expect(claimed("ground_bat_bones")).not.toBe("bones");
    expect(claimed("bat_bones")).toBe("bones");
  });

  it("keeps armour out of the material blocks", () => {
    for (const armour of ["leather_gloves", "leather_boots", "dragonhide_body", "black_dragonhide_chaps", "hardleather_body"]) {
      expect(claimed(armour), armour).not.toBe("hides");
    }
    for (const material of ["cow_hide", "leather", "hard_leather", "dragonhide_green", "dragon_leather_blue"]) {
      expect(claimed(material), material).toBe("hides");
    }
  });

  it("keeps the quest reagents out of Herbs but not the quest herbs", () => {
    expect(claimed("unidentified_liquid")).not.toBe("herbs");
    expect(claimed("unidentified_powder")).not.toBe("herbs");
    expect(claimed("unidentified_snake_weed")).toBe("herbs");
    expect(claimed("unidentified_guam")).toBe("herbs");
  });

  it("counts only real coins as coins", () => {
    // 617 is `fake_coins` and 996..1004 are the stack-icon variants. Anything
    // but 995 in this group would corrupt the one figure the page leads with.
    expect(map.coins).toEqual([995]);
    expect(claimed("fake_coins")).toBeNull();
  });
});

describe("Rares", () => {
  it("is a roster, so the block can print a line for something that does not exist", () => {
    const roster = groupRoster("rares");
    expect(roster).toHaveLength(15);
    expect(groupRoster("ores")).toBeNull();
  });

  it("carries the fifteen the engine follows, and their notes", () => {
    expect(members("rares")).toEqual([
      "Blue partyhat",
      "Christmas cracker",
      "Disk of returning",
      "Easter egg",
      "Green partyhat",
      "Half full wine jug",
      "Halloween mask (blue)",
      "Halloween mask (green)",
      "Halloween mask (red)",
      "Pumpkin",
      "Purple partyhat",
      "Red partyhat",
      "Santa hat",
      "White partyhat",
      "Yellow partyhat",
    ]);
    expect(map.rares).toHaveLength(30);
  });

  // Only when the content repo is checked out beside this one: the roster is
  // copied into groups.ts because a deploy has no Server tree, and this is what
  // stops the copy drifting from the engine's own list.
  const tracked = "../Server/engine/data/config/economy.json";

  it.skipIf(!existsSync(tracked))("matches the engine's tracked list exactly", () => {
    const config = JSON.parse(readFileSync(tracked, "utf8")) as { tracked: { id: number }[] };
    const engine = config.tracked.map((item) => item.id).sort((a, b) => a - b);
    expect([...groupRoster("rares")!].sort((a, b) => a - b)).toEqual(engine);
  });
});

describe("what lands in each block", () => {
  // Names, not ids, and committed. A rule edit or a content bump then shows up
  // in review as "+ Chocolate bar" under Bars — the one failure mode that
  // reading a regular expression will not catch.
  for (const group of GROUPS) {
    it(`${group.label} holds what it says`, () => {
      expect(members(group.key)).toMatchSnapshot();
    });
  }

  it("leaves everything else to Other items", () => {
    // Pinned so a content bump that adds twelve ores has to be looked at rather
    // than quietly swelling the residual block.
    expect(unclassifiedIds()).toHaveLength(3557);
  });
});
