import { describe, expect, it } from "vitest";

import { GZ_NAMES, GZ_TAKE_MAX, type Gz, gzWho, runGz, takeIds, withGiven, withTaken } from "./gz";

const NONE: Gz = { count: 0, names: [], mine: false };

/** `n` distinct givers, newest first: giver0, giver1, ... */
function givers(n: number, from = 0): string[] {
  return Array.from({ length: n }, (_, i) => `giver${from + i}`);
}

describe("runGz", () => {
  it("is nobody's for no events, and one event's own gz for one", () => {
    expect(runGz([])).toEqual(NONE);
    const one: Gz = { count: 2, names: ["lynx_titan", "b0aty"], mine: true };
    expect(runGz([{ gz: one }])).toEqual(one);
  });

  it("counts everyone who gave to any level once, newest level's names first", () => {
    const run = runGz([
      { gz: { count: 2, names: ["lynx_titan", "b0aty"], mine: false } },
      { gz: { count: 2, names: ["b0aty", "pk_andy"], mine: false } },
      { gz: NONE },
    ]);
    expect(run).toEqual({ count: 3, names: ["lynx_titan", "b0aty", "pk_andy"], mine: false });
  });

  it("is the viewer's when they gave to any level in it", () => {
    expect(
      runGz([{ gz: NONE }, { gz: { count: 1, names: ["lynx_titan"], mine: true } }]).mine,
    ).toBe(true);
  });

  it("adds the counts up when a list of names is cut short, since it cannot tell who is in both", () => {
    const capped: Gz = { count: 60, names: givers(GZ_NAMES), mine: false };
    const run = runGz([{ gz: capped }, { gz: { count: 2, names: ["giver0", "zezima"], mine: false } }]);
    expect(run.count).toBe(62);
    expect(run.names).toEqual([...givers(GZ_NAMES), "zezima"]);
  });
});

describe("withGiven", () => {
  it("adds the viewer first and counts them", () => {
    expect(withGiven({ count: 1, names: ["b0aty"], mine: false }, "lynx_titan")).toEqual({
      count: 2,
      names: ["lynx_titan", "b0aty"],
      mine: true,
    });
  });

  it("changes nothing when the gz is already theirs", () => {
    const mine: Gz = { count: 1, names: ["lynx_titan"], mine: true };
    expect(withGiven(mine, "lynx_titan")).toEqual(mine);
  });

  it("never lists the viewer twice", () => {
    expect(withGiven({ count: 1, names: ["lynx_titan"], mine: false }, "lynx_titan").names).toEqual(["lynx_titan"]);
  });
});

describe("withTaken", () => {
  it("takes the viewer out and uncounts them", () => {
    expect(withTaken({ count: 2, names: ["lynx_titan", "b0aty"], mine: true }, "lynx_titan")).toEqual({
      count: 1,
      names: ["b0aty"],
      mine: false,
    });
  });

  it("changes nothing when the gz is not theirs", () => {
    const theirs: Gz = { count: 1, names: ["b0aty"], mine: false };
    expect(withTaken(theirs, "lynx_titan")).toEqual(theirs);
  });

  it("uncounts them even when their name was past the newest fifty", () => {
    const names = givers(GZ_NAMES);
    expect(withTaken({ count: 70, names, mine: true }, "lynx_titan")).toEqual({ count: 69, names, mine: false });
  });

  it("undoes a give exactly", () => {
    const before: Gz = { count: 2, names: ["b0aty", "pk_andy"], mine: false };
    expect(withTaken(withGiven(before, "lynx_titan"), "lynx_titan")).toEqual(before);
  });
});

describe("gzWho", () => {
  it("is the givers' display names, newest first", () => {
    expect(gzWho({ count: 2, names: ["lynx_titan", "b0aty"], mine: false })).toBe("Lynx Titan, B0aty");
  });

  it("says how many more there are than it names", () => {
    expect(gzWho({ count: 53, names: givers(GZ_NAMES), mine: false })).toMatch(/, Giver49 and 3 more$/);
  });

  it("names at most fifty, however many a run gathered", () => {
    const who = gzWho({ count: 80, names: givers(80), mine: false });
    expect(who).toMatch(/Giver49 and 30 more$/);
    expect(who).not.toContain("Giver50");
  });

  it("is empty for nobody", () => {
    expect(gzWho(NONE)).toBe("");
  });
});

describe("takeIds", () => {
  it("takes one to fifty adventure ids", () => {
    expect(takeIds([3])).toEqual([3]);
    const fifty = Array.from({ length: GZ_TAKE_MAX }, (_, i) => i + 1);
    expect(takeIds(fifty)).toEqual(fifty);
  });

  it("refuses none, more than fifty, or anything but a list", () => {
    expect(takeIds([])).toBeNull();
    expect(takeIds(Array.from({ length: GZ_TAKE_MAX + 1 }, (_, i) => i + 1))).toBeNull();
    for (const bad of [undefined, null, 3, "3", { 0: 3 }]) expect(takeIds(bad)).toBeNull();
  });

  it("refuses a list with anything that is not a row id in it", () => {
    for (const bad of [0, -1, 1.5, "3", null, Number.NaN, 2147483648, 1e21]) {
      expect(takeIds([1, bad])).toBeNull();
    }
    expect(takeIds([2147483647])).toEqual([2147483647]);
  });
});
