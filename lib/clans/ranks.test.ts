import { describe, expect, it } from "vitest";

import {
  byRank,
  DEFAULT_PERMS,
  isRank,
  may,
  outranks,
  PERM_ACTIONS,
  PERM_KEYS,
  PERM_LABELS,
  RANK_NAMES,
  RANKS,
  rankLevel,
  ranksBelow,
  youAre,
} from "./ranks";

describe("the ranks", () => {
  it("are the clan-chat ladder, the Leader first", () => {
    expect(RANKS).toEqual(["leader", "general", "captain", "lieutenant", "sergeant", "corporal", "recruit"]);
    expect(RANKS.map((rank) => RANK_NAMES[rank])).toEqual([
      "Leader", "General", "Captain", "Lieutenant", "Sergeant", "Corporal", "Recruit",
    ]);
    expect(RANKS.map(rankLevel)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("outrank only the ranks below them", () => {
    expect(outranks("leader", "general")).toBe(true);
    expect(outranks("captain", "recruit")).toBe(true);
    expect(outranks("general", "general")).toBe(false);
    expect(outranks("recruit", "leader")).toBe(false);
  });

  it("give only ranks below their own, so the Leader can make Generals", () => {
    expect(ranksBelow("leader")).toEqual(["general", "captain", "lieutenant", "sergeant", "corporal", "recruit"]);
    expect(ranksBelow("captain")).toEqual(["lieutenant", "sergeant", "corporal", "recruit"]);
    expect(ranksBelow("recruit")).toEqual([]);
  });

  it("tell a rank from anything else", () => {
    expect(isRank("sergeant")).toBe(true);
    for (const bad of ["owner", "Leader", "", null, 3]) expect(isRank(bad)).toBe(false);
  });

  it("say who you are", () => {
    expect(youAre("leader")).toBe("You are the Leader");
    expect(youAre("corporal")).toBe("You are a Corporal");
  });
});

describe("Who can…", () => {
  it("has the spec's four actions and defaults", () => {
    expect(PERM_KEYS).toEqual(["invite", "remove", "ranks", "page"]);
    expect(DEFAULT_PERMS).toEqual({ invite: 4, remove: 1, ranks: 1, page: 2 });
    expect(Object.keys(PERM_ACTIONS)).toEqual(PERM_KEYS);
  });

  it("labels the seven levels", () => {
    expect(PERM_LABELS).toEqual([
      "Leader only",
      "General and above",
      "Captain and above",
      "Lieutenant and above",
      "Sergeant and above",
      "Corporal and above",
      "Every member",
    ]);
  });

  it("lets a rank act when its level is at or under the threshold", () => {
    expect(may("invite", "sergeant", DEFAULT_PERMS)).toBe(true);
    expect(may("invite", "corporal", DEFAULT_PERMS)).toBe(false);
    expect(may("remove", "general", DEFAULT_PERMS)).toBe(true);
    expect(may("remove", "captain", DEFAULT_PERMS)).toBe(false);
    expect(may("page", "captain", DEFAULT_PERMS)).toBe(true);
    expect(may("page", "lieutenant", DEFAULT_PERMS)).toBe(false);
    expect(may("invite", "recruit", { ...DEFAULT_PERMS, invite: 6 })).toBe(true);
    expect(may("ranks", "general", { ...DEFAULT_PERMS, ranks: 0 })).toBe(false);
    expect(may("ranks", "leader", { ...DEFAULT_PERMS, ranks: 0 })).toBe(true);
  });
});

describe("byRank", () => {
  it("groups a roster by rank, top first, keeping each group's order and leaving out empty ranks", () => {
    const roster = [
      { username: "zezima", rank: "leader" as const },
      { username: "nel", rank: "captain" as const },
      { username: "fresh", rank: "recruit" as const },
      { username: "lynx", rank: "captain" as const },
    ];
    expect(byRank(roster)).toEqual([
      { rank: "leader", members: [roster[0]] },
      { rank: "captain", members: [roster[1], roster[3]] },
      { rank: "recruit", members: [roster[2]] },
    ]);
    expect(byRank([])).toEqual([]);
  });
});
