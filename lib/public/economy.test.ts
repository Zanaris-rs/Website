import { describe, expect, it } from "vitest";

import { ECONOMY_FLOW_ROW_LIMIT, type Flow, type Snapshot } from "./queries";
import {
  BLOCK_ROWS,
  chartPath,
  dailyChange,
  dailyFlows,
  economyBlocks,
  foldNotes,
  latestSnapshot,
  rangeOf,
  seriesOf,
  utcDay,
} from "./economy";

const snapshot = (at: string, players: number, coins: number): Snapshot => ({
  takenAt: at,
  players,
  coins,
  tracked: [],
});

describe("chartPath", () => {
  it("draws nothing when the census has not run", () => {
    expect(chartPath([], 100, 20)).toBeNull();
  });

  it("scales the points to fill the box, oldest on the left", () => {
    const chart = chartPath(
      [
        { at: "2026-09-01T00:00:00Z", value: 10 },
        { at: "2026-09-02T00:00:00Z", value: 20 },
        { at: "2026-09-03T00:00:00Z", value: 15 },
      ],
      100,
      20,
      0,
    );

    expect(chart?.path).toBe("M 0 20 L 50 0 L 100 10");
    expect(chart?.min).toBe(10);
    expect(chart?.max).toBe(20);
    expect(chart?.first.value).toBe(10);
    expect(chart?.last.value).toBe(15);
    expect(chart?.count).toBe(3);
  });

  it("keeps the stroke inside the box", () => {
    const chart = chartPath(
      [
        { at: "a", value: 0 },
        { at: "b", value: 1 },
      ],
      100,
      20,
      1,
    );
    expect(chart?.path).toBe("M 0 19 L 100 1");
  });

  it("draws a flat line through the middle when nothing has moved", () => {
    const flat = chartPath(
      [
        { at: "a", value: 7 },
        { at: "b", value: 7 },
      ],
      100,
      20,
      0,
    );
    expect(flat?.path).toBe("M 0 10 L 100 10");
    expect(flat?.min).toBe(7);
    expect(flat?.max).toBe(7);
  });

  it("gives a single sample a line rather than an invisible dot", () => {
    const one = chartPath([{ at: "a", value: 7 }], 100, 20, 0);
    expect(one?.path).toBe("M 0 10 L 100 10");
    expect(one?.count).toBe(1);
  });

  it("closes the area down to the baseline", () => {
    const chart = chartPath(
      [
        { at: "a", value: 0 },
        { at: "b", value: 1 },
      ],
      100,
      20,
      0,
    );
    expect(chart?.area).toBe("M 0 20 L 100 0 L 100 20 L 0 20 Z");
  });
});

describe("seriesOf", () => {
  it("takes the points a column has and skips the hours it does not", () => {
    const series = seriesOf(
      [
        snapshot("2026-09-01T00:00:00Z", 10, 100),
        { takenAt: "2026-09-02T00:00:00Z", players: null, coins: 5, tracked: [] },
        { takenAt: null, players: 3, coins: 5, tracked: [] },
      ],
      (s) => s.players,
    );
    expect(series).toEqual([{ at: "2026-09-01T00:00:00Z", value: 10 }]);
  });
});

describe("utcDay", () => {
  it("is the UTC calendar day, or null", () => {
    expect(utcDay("2026-09-05T23:30:00Z")).toBe("2026-09-05");
    expect(utcDay(null)).toBeNull();
    expect(utcDay("never")).toBeNull();
  });
});

describe("dailyFlows", () => {
  const flow = (at: string, itemId: number, delta: number): Flow => ({
    takenAt: at,
    itemId,
    delta,
  });

  it("sums the hourly rows into days, newest day first", () => {
    expect(
      dailyFlows([
        flow("2026-09-04T01:00:00Z", 1038, 1),
        flow("2026-09-04T09:00:00Z", 1038, 2),
        flow("2026-09-05T09:00:00Z", 1050, -1),
      ]),
    ).toEqual({
      days: [
        { day: "2026-09-05", items: [{ itemId: 1050, delta: -1 }] },
        { day: "2026-09-04", items: [{ itemId: 1038, delta: 3 }] },
      ],
      truncated: false,
    });
  });

  it("drops an item that came back the same day, and a day left with nothing", () => {
    expect(
      dailyFlows([
        flow("2026-09-04T01:00:00Z", 1038, 1),
        flow("2026-09-04T09:00:00Z", 1038, -1),
      ]),
    ).toEqual({ days: [], truncated: false });
  });

  it("puts the biggest movement of a day first", () => {
    const [day] = dailyFlows([
      flow("2026-09-04T01:00:00Z", 1038, 1),
      flow("2026-09-04T01:00:00Z", 1050, -4),
      flow("2026-09-04T01:00:00Z", 962, 2),
    ]).days;
    expect(day.items.map((item) => item.itemId)).toEqual([1050, 962, 1038]);
  });

  it("ignores a row with no timestamp", () => {
    expect(dailyFlows([{ takenAt: null, itemId: 1, delta: 1 }])).toEqual({
      days: [],
      truncated: false,
    });
  });

  it("says so, and drops the half-read day, at the SQL's row ceiling", () => {
    // `public_economy_flow` is `ORDER BY taken_at DESC ... LIMIT 5000`, so a
    // window busier than that comes back with its oldest rows missing and the
    // cut somewhere inside a day. Two days here: a complete newest one and an
    // oldest one that is whatever was left of the budget.
    const rows: Flow[] = [];
    for (let i = 0; i < ECONOMY_FLOW_ROW_LIMIT - 1; i++) {
      rows.push(flow("2026-09-05T09:00:00Z", 1038, 1));
    }
    rows.push(flow("2026-09-04T09:00:00Z", 1050, 1));

    const folded = dailyFlows(rows);
    expect(folded.truncated).toBe(true);
    // The oldest day is not shown as "one whip entered": some unknown number
    // of its rows was never returned, and a wrong figure on a page whose whole
    // point is being checkable is worse than a missing one.
    expect(folded.days).toEqual([
      { day: "2026-09-05", items: [{ itemId: 1038, delta: 4_999 }] },
    ]);
  });

  it("keeps every day when the read came back under the ceiling", () => {
    const rows: Flow[] = [];
    for (let i = 0; i < ECONOMY_FLOW_ROW_LIMIT - 2; i++) {
      rows.push(flow("2026-09-05T09:00:00Z", 1038, 1));
    }
    rows.push(flow("2026-09-04T09:00:00Z", 1050, 1));

    const folded = dailyFlows(rows);
    expect(folded.truncated).toBe(false);
    expect(folded.days.map((day) => day.day)).toEqual([
      "2026-09-05",
      "2026-09-04",
    ]);
  });
});

describe("latestSnapshot", () => {
  it("is the last of the series, or null", () => {
    expect(latestSnapshot([])).toBeNull();
    expect(
      latestSnapshot([
        snapshot("2026-09-04T00:00:00Z", 1, 1),
        snapshot("2026-09-05T00:00:00Z", 2, 2),
      ])?.players,
    ).toBe(2);
  });
});

describe("dailyChange", () => {
  it("compares the newest census with the newest one a day or more older", () => {
    const change = dailyChange(
      [
        snapshot("2026-09-03T12:00:00Z", 10, 100),
        // 25 hours before the newest: this is the one to compare against.
        snapshot("2026-09-04T11:00:00Z", 12, 120),
        snapshot("2026-09-04T13:00:00Z", 13, 130),
        snapshot("2026-09-05T12:00:00Z", 20, 200),
      ],
      (s) => s.coins,
    );
    expect(change).toBe(80);
  });

  it("is null until the series reaches back a day", () => {
    expect(
      dailyChange(
        [
          snapshot("2026-09-05T10:00:00Z", 10, 100),
          snapshot("2026-09-05T12:00:00Z", 11, 110),
        ],
        (s) => s.coins,
      ),
    ).toBeNull();
    expect(dailyChange([], (s) => s.coins)).toBeNull();
  });

  it("is null when either end of the comparison was not counted", () => {
    expect(
      dailyChange(
        [
          { takenAt: "2026-09-04T10:00:00Z", players: null, coins: null, tracked: [] },
          snapshot("2026-09-05T12:00:00Z", 11, 110),
        ],
        (s) => s.coins,
      ),
    ).toBeNull();
  });
});

/* --- the categories --- */

describe("rangeOf", () => {
  it("is the lowest and the highest the series reached", () => {
    expect(
      rangeOf([
        { at: "2026-09-01T00:00:00.000Z", value: 5 },
        { at: "2026-09-02T00:00:00.000Z", value: 1 },
        { at: "2026-09-03T00:00:00.000Z", value: 9 },
      ]),
    ).toEqual({
      low: 1,
      high: 9,
    });
  });

  it("is null for a series with nothing in it", () => {
    // Not {low: 0, high: 0}: "it has never been counted" and "it has always
    // been none" are different sentences on this page.
    expect(rangeOf([])).toBeNull();
  });
});

describe("foldNotes", () => {
  // 441 is a note for 440; 999 is not a note at all.
  const baseIdOf = (id: number) => (id === 441 ? 440 : id);

  it("moves a note's count onto the object it is a note for", () => {
    expect(
      foldNotes([{ id: 440, count: 100 }, { id: 441, count: 20 }], baseIdOf).sort(
        (a, b) => a.id - b.id,
      ),
    ).toEqual([{ id: 440, count: 120 }]);
  });

  it("keeps a note whose base it cannot find, rather than losing the count", () => {
    expect(foldNotes([{ id: 999, count: 3 }], baseIdOf)).toEqual([
      { id: 999, count: 3 },
    ]);
  });
});

describe("economyBlocks", () => {
  // 1 iron ore (priced), 2 coal (priced), 3 red partyhat (unpriced),
  // 4 santa hat (priced), 5 an object no group claims.
  const NAMES: Record<number, string> = {
    1: "Iron ore",
    2: "Coal",
    3: "Red partyhat",
    4: "Santa hat",
    5: "Arrow shaft",
  };
  const GROUP: Record<number, string | null> = {
    1: "ores",
    2: "ores",
    3: "rares",
    4: "rares",
    5: null,
  };
  const COST: Record<number, number | null> = {
    1: 17,
    2: 45,
    3: null,
    4: 160,
    5: 1,
  };

  const catalogue = {
    groupOf: (id: number) => GROUP[id] ?? null,
    baseIdOf: (id: number) => id,
    name: (id: number) => NAMES[id] ?? `Item ${id}`,
    cost: (id: number) => COST[id] ?? null,
  };

  const specs = [
    { key: "ores", label: "Ores", roster: null },
    { key: "rares", label: "Rares", roster: [3, 4] },
  ];

  const blocks = (
    items: { id: number; count: number }[],
    ranges: Map<string, { low: number; high: number }> | null = null,
  ) => economyBlocks(items, ranges, specs, catalogue, "*");

  it("keeps the order it was given, and adds the residual last", () => {
    expect(blocks([]).map((block) => block.key)).toEqual(["ores", "rares", "*"]);
  });

  it("sends an object no group claims to the residual", () => {
    const [, , other] = blocks([{ id: 5, count: 7 }]);
    expect(other.items).toEqual([{ id: 5, count: 7 }]);
    expect(other.count).toBe(7);
  });

  it("prints a roster block in name order, zeroes and all", () => {
    // The zero line is the point of a roster: "Blue partyhat 0" is the most
    // interesting row on the page, and the census stores no id it did not count.
    const [, rares] = blocks([{ id: 4, count: 2 }]);
    expect(rares.items).toEqual([
      { id: 3, count: 0 },
      { id: 4, count: 2 },
    ]);
  });

  it("prints every other block biggest first", () => {
    const [ores] = blocks([{ id: 1, count: 5 }, { id: 2, count: 90 }]);
    expect(ores.items).toEqual([
      { id: 2, count: 90 },
      { id: 1, count: 5 },
    ]);
  });

  it("values a block from the objects that declare a price", () => {
    const [ores] = blocks([{ id: 1, count: 10 }, { id: 2, count: 2 }]);
    expect(ores.count).toBe(12);
    expect(ores.value).toBe(10 * 17 + 2 * 45);
    expect(ores.priced).toBe(2);
    expect(ores.counted).toBe(2);
  });

  it("says how many of a block's objects it could price", () => {
    const [, rares] = blocks([{ id: 3, count: 9 }, { id: 4, count: 1 }]);
    expect(rares.counted).toBe(2);
    expect(rares.priced).toBe(1);
    expect(rares.value).toBe(160);
  });

  it("puts no value at all on a block where nothing declares a price", () => {
    // `null`, never 0 and never the engine's default of 1 — nine hundred
    // partyhats are not worth nine hundred coins.
    const [, rares] = blocks([{ id: 3, count: 900 }]);
    expect(rares.count).toBe(900);
    expect(rares.value).toBeNull();
    expect(rares.priced).toBe(0);
  });

  it("ignores an object the census counted none of", () => {
    const [ores] = blocks([{ id: 1, count: 0 }]);
    expect(ores.items).toEqual([]);
    expect(ores.counted).toBe(0);
    expect(ores.value).toBeNull();
  });

  it("takes each block's low and high from the ranges, residual included", () => {
    const ranges = new Map([
      ["ores", { low: 0, high: 17361 }],
      ["*", { low: 3586, high: 647920 }],
    ]);
    const [ores, rares, other] = blocks([{ id: 1, count: 1 }], ranges);

    expect([ores.low, ores.high]).toEqual([0, 17361]);
    expect([other.low, other.high]).toEqual([3586, 647920]);
    // A group the read did not return has no range, which the page prints as
    // nothing rather than as zero.
    expect([rares.low, rares.high]).toEqual([null, null]);
  });

  it("has no ranges at all when that read failed", () => {
    const [ores] = blocks([{ id: 1, count: 1 }], null);
    expect([ores.low, ores.high]).toEqual([null, null]);
  });

  it("caps a long block and reports what it is a top of", () => {
    const many = Array.from({ length: BLOCK_ROWS + 12 }, (_, i) => ({
      id: 1000 + i,
      count: i + 1,
    }));
    const [, , other] = blocks(many);

    expect(other.items).toHaveLength(BLOCK_ROWS);
    expect(other.of).toBe(BLOCK_ROWS + 12);
    // The count is of everything, not of the rows shown.
    expect(other.count).toBe(many.reduce((sum, item) => sum + item.count, 0));
  });

  it("folds a note into its base before anything else happens", () => {
    const noted = {
      ...catalogue,
      baseIdOf: (id: number) => (id === 101 ? 1 : id),
    };
    const [ores] = economyBlocks(
      [{ id: 1, count: 10 }, { id: 101, count: 5 }],
      null,
      specs,
      noted,
      "*",
    );

    expect(ores.items).toEqual([{ id: 1, count: 15 }]);
    expect(ores.counted).toBe(1);
    expect(ores.value).toBe(15 * 17);
  });
});
