import { describe, expect, it } from "vitest";

import { groupOf } from "@/lib/items/groups";
import { itemName } from "@/lib/items/names";
import { allItemIds, baseIdOf, debugName, isNote } from "@/lib/items/objects";

import { parseItemQuery, searchCensus } from "./search";

/** Five made-up objects, so the rules are readable without 3,883 real ones. */
const NAMES: Record<number, string> = {
  1: "Iron ore",
  2: "Iron bar",
  3: "Blue partyhat",
  4: "Bar magnet",
  5: "Iron ore (noted)",
};
const DEBUG: Record<number, string> = {
  1: "iron_ore",
  2: "iron_bar",
  3: "blue_partyhat",
  4: "bar_magnet",
  5: "cert_iron_ore",
};
const CATALOGUE = {
  name: (id: number) => NAMES[id] ?? `Item ${id}`,
  debugName: (id: number) => DEBUG[id] ?? "",
  groupOf: (id: number) => (id === 3 ? "rares" : "ores"),
  isNote: (id: number) => id === 5,
  baseIdOf: (id: number) => (id === 5 ? 1 : id),
};
const IDS = [1, 2, 3, 4, 5];
const counts = (entries: [number, number][]) => new Map(entries);

const search = (query: string, limit = 100) =>
  searchCensus(query, IDS, counts([[1, 40], [2, 7], [4, 2]]), CATALOGUE, limit);

describe("parseItemQuery", () => {
  it("reads nothing as no query at all", () => {
    expect(parseItemQuery(undefined)).toBe("");
  });

  it("takes the first of a repeated parameter rather than throwing", () => {
    expect(parseItemQuery(["iron", "bar"])).toBe("iron");
  });

  it("trims what someone pasted", () => {
    expect(parseItemQuery("  iron ore  ")).toBe("iron ore");
  });

  it("caps a query nobody typed by hand", () => {
    expect(parseItemQuery("a".repeat(500))).toHaveLength(64);
  });
});

describe("searchCensus", () => {
  it("finds nothing for an empty query, so the page shows its catalogue instead", () => {
    expect(search("")).toEqual({ matches: [], total: 0 });
  });

  it("matches part of a display name, whatever the case", () => {
    expect(search("IRON").matches.map((m) => m.id)).toEqual([1, 2]);
  });

  it("matches the debug name an auditor would type", () => {
    expect(search("iron_ore").matches.map((m) => m.id)).toEqual([1]);
  });

  it("matches an id outright, because that is how a claim gets checked", () => {
    expect(search("3").matches.map((m) => m.id)).toEqual([3]);
  });

  it("shows an item nobody owns as zero rather than leaving it out", () => {
    const partyhat = search("partyhat").matches[0];
    expect(partyhat).toMatchObject({ id: 3, count: 0 });
  });

  it("folds notes away, so a note is never a row of its own", () => {
    expect(search("noted").matches).toEqual([]);
    expect(search("cert").matches).toEqual([]);
  });

  it("ranks a whole-word match above one buried inside another word", () => {
    expect(search("bar").matches.map((m) => m.id)).toEqual([2, 4]);
  });

  it("puts an exact name first", () => {
    expect(search("iron bar").matches[0].id).toBe(2);
  });

  it("carries the group, so a flat result can still say where a row belongs", () => {
    expect(search("partyhat").matches[0].group).toBe("rares");
  });

  it("caps the rows but still counts what it found", () => {
    expect(search("iron", 1)).toMatchObject({ total: 2 });
    expect(search("iron", 1).matches).toHaveLength(1);
  });
});

/**
 * The same rules against the 3,883 objects the game actually has. The fixture
 * above says what the rules are; this says they survive the real table.
 */
describe("searchCensus over the real catalogue", () => {
  const CATALOGUE = {
    name: itemName,
    debugName,
    groupOf: (id: number) => groupOf(id) ?? "*",
    isNote,
    baseIdOf,
  };
  const ids = allItemIds();
  const find = (q: string, limit = 100) =>
    searchCensus(q, ids, new Map(), CATALOGUE, limit);

  it("finds every partyhat, none of them owned by anybody", () => {
    const { matches } = find("partyhat");
    expect(matches.map((m) => m.name)).toContain("Blue partyhat");
    expect(matches.every((m) => m.count === 0)).toBe(true);
  });

  it("answers a debug name exactly", () => {
    expect(find("iron_ore").matches.map((m) => m.id)).toEqual([440]);
  });

  it("answers an id with the one object that has it", () => {
    expect(find("995").matches).toEqual([
      { id: 995, name: "Coins", count: 0, group: "coins" },
    ]);
  });

  it("leaves notes out, so 2,618 base objects are searchable of 3,883 ids", () => {
    expect(ids.filter((id) => !isNote(id))).toHaveLength(2618);
    expect(find("cert").matches.every((m) => !isNote(m.id))).toBe(true);
  });

  it("caps a broad query and still reports how much it found", () => {
    const rune = find("rune", 10);
    expect(rune.matches).toHaveLength(10);
    expect(rune.total).toBeGreaterThan(100);
  });
});
