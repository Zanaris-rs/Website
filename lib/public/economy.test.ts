import { describe, expect, it } from "vitest";

import { ECONOMY_FLOW_ROW_LIMIT, type Flow, type Snapshot } from "./queries";
import {
  chartPath,
  dailyChange,
  dailyFlows,
  latestSnapshot,
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
