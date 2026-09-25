import { describe, expect, it } from "vitest";

import { parseRecords, recordsStatement } from "./records";

const HOSTILE = "x'); drop table account; --";

describe("recordsStatement", () => {
  it("asks migration 015's function, with the name in the values", () => {
    expect(recordsStatement("zezima")).toEqual({
      text: "select * from accounts.adventure_log_records($1)",
      values: ["zezima"],
    });
    expect(recordsStatement(HOSTILE).text).not.toContain("drop");
    expect(recordsStatement(HOSTILE).values).toEqual([HOSTILE]);
  });
});

describe("parseRecords", () => {
  it("reads one row per duration, shortest first, and divides XP by ten", () => {
    const rows = [
      {
        duration_seconds: 300,
        gained: 123450,
        elapsed_ms: 298000,
        achieved_at: "2026-09-20T10:00:00Z",
        rank: 2,
      },
      {
        duration_seconds: 21600,
        gained: 4500000,
        elapsed_ms: 21599000,
        achieved_at: "2026-09-21T08:00:00Z",
        rank: 1,
      },
    ];

    expect(parseRecords(rows)).toEqual([
      {
        durationSeconds: 300,
        gained: 12345,
        elapsedMs: 298000,
        achievedAt: "2026-09-20T10:00:00.000Z",
        rank: 2,
      },
      {
        durationSeconds: 21600,
        gained: 450000,
        elapsedMs: 21599000,
        achievedAt: "2026-09-21T08:00:00.000Z",
        rank: 1,
      },
    ]);
  });

  it("floors a gain that doesn't divide by ten evenly, the same as xpFromValue", () => {
    expect(
      parseRecords([
        { duration_seconds: 300, gained: 25009, elapsed_ms: 1000, achieved_at: "2026-09-20T10:00:00Z", rank: 1 },
      ])[0].gained,
    ).toBe(2500);
  });

  it("answers no rows with no rows - a player with no board place, or only a rejected attempt", () => {
    expect(parseRecords([])).toEqual([]);
  });

  it("throws on a row that isn't documented, instead of guessing", () => {
    const base = {
      duration_seconds: 300,
      gained: 123450,
      elapsed_ms: 298000,
      achieved_at: "2026-09-20T10:00:00Z",
      rank: 2,
    };
    expect(() => parseRecords([undefined])).toThrow(/not a row/);
    expect(() => parseRecords([null])).toThrow(/not a row/);
    expect(() => parseRecords([{ ...base, duration_seconds: "300" }])).toThrow(/duration_seconds/);
    expect(() => parseRecords([{ ...base, gained: "123450" }])).toThrow(/gained/);
    expect(() => parseRecords([{ ...base, gained: null }])).toThrow(/gained/);
    expect(() => parseRecords([{ ...base, elapsed_ms: "298000" }])).toThrow(/elapsed_ms/);
    expect(() => parseRecords([{ ...base, achieved_at: "not a date" }])).toThrow(/achieved_at/);
    expect(() => parseRecords([{ ...base, achieved_at: null }])).toThrow(/achieved_at/);
    expect(() => parseRecords([{ ...base, rank: 0.5 }])).toThrow(/rank/);
    expect(() => parseRecords([{ ...base, rank: null }])).toThrow(/rank/);
  });
});
