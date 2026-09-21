import { describe, expect, it } from "vitest";

import {
  BOARD_LIMIT,
  HISTORY_LIMIT,
  RECORD_STATUS,
  START_RESULTS,
  STOP_RESULTS,
  parseRecordAbandon,
  parseRecordBoardRow,
  parseRecordCurrent,
  parseRecordDurationRow,
  parseRecordHistoryRow,
  parseRecordSkillRow,
  parseRecordStart,
  parseRecordStop,
  recordAbandonStatement,
  recordAttemptSkillsStatement,
  recordBoardStatement,
  recordCurrentStatement,
  recordDurationsStatement,
  recordHistoryStatement,
  recordStartStatement,
  recordStatusFor,
  recordStopStatement,
} from "./queries";

const NOW = new Date("2026-09-21T12:00:00.000Z");
const STARTED = new Date("2026-09-21T11:50:00.000Z");

describe("statements", () => {
  it("call migration 8's functions positionally and interpolate nothing", () => {
    const hostile = "'); drop table record_attempt; --";
    const cases = [
      [recordStartStatement(hostile, 300), "select * from accounts.record_start($1, $2)", [hostile, 300]],
      [recordStopStatement(hostile), "select * from accounts.record_stop($1)", [hostile]],
      [recordAbandonStatement(hostile), "select accounts.record_abandon($1) as result", [hostile]],
      [recordCurrentStatement(hostile), "select * from accounts.record_current($1)", [hostile]],
      [recordHistoryStatement(hostile), "select * from accounts.record_history($1, $2)", [hostile, HISTORY_LIMIT]],
      [recordAttemptSkillsStatement(hostile, 7), "select * from accounts.record_attempt_skills($1, $2)", [hostile, 7]],
      [recordBoardStatement(300, 9), "select * from accounts.record_board($1, $2, $3)", [300, 9, BOARD_LIMIT]],
      [recordDurationsStatement(), "select * from accounts.record_durations()", []],
    ] as const;

    for (const [statement, text, values] of cases) {
      expect(statement.text).toBe(text);
      expect(statement.values).toEqual(values);
      expect(statement.text).not.toContain("drop table");
    }
  });
});

describe("parseRecordStart and parseRecordStop", () => {
  it("accept every documented answer and nothing else", () => {
    for (const result of START_RESULTS) {
      expect(parseRecordStart({ result, attempt_id: null, started_at: null })).toBe(result);
    }
    expect(() => parseRecordStart({ result: "maybe" })).toThrow(/record_start/);
    expect(() => parseRecordStart(undefined)).toThrow(/record_start/);
  });

  it("carry how the attempt closed only on ok", () => {
    expect(parseRecordStop({ result: "ok", attempt_id: 3, state: "valid", reason: null })).toEqual({
      result: "ok",
      state: "valid",
      reason: null,
    });
    expect(parseRecordStop({ result: "ok", attempt_id: 3, state: "rejected", reason: "over_time" })).toEqual({
      result: "ok",
      state: "rejected",
      reason: "over_time",
    });
    for (const result of STOP_RESULTS.filter((r) => r !== "ok")) {
      expect(parseRecordStop({ result, attempt_id: 3, state: "running", reason: null })).toEqual({
        result,
        state: null,
        reason: null,
      });
    }
  });

  it("refuse a verdict nobody documented", () => {
    expect(() => parseRecordStop({ result: "ok", state: "sorted", reason: null })).toThrow(/state/);
    expect(() => parseRecordStop({ result: "ok", state: "void", reason: "gremlins" })).toThrow(/reason/);
  });

  it("parse abandon's bare text", () => {
    expect(parseRecordAbandon("ok")).toBe("ok");
    expect(parseRecordAbandon("not_running")).toBe("not_running");
    expect(() => parseRecordAbandon("nah")).toThrow(/record_abandon/);
  });
});

describe("parseRecordCurrent", () => {
  it("throws on anything but exactly one row - no rows is a broken read, not 'no attempt'", () => {
    expect(() => parseRecordCurrent([])).toThrow(/0 rows/);
    expect(() =>
      parseRecordCurrent([
        { presence: "never", server_now: NOW },
        { presence: "never", server_now: NOW },
      ]),
    ).toThrow(/2 rows/);
  });

  it("reads a player with no attempt as attempt: null", () => {
    expect(
      parseRecordCurrent([{ presence: "never", logout_time: null, server_now: NOW, attempt_id: null }]),
    ).toEqual({ presence: "never", logoutTime: null, serverNow: NOW.toISOString(), attempt: null });
  });

  it("reads a finished attempt, raw XP untouched", () => {
    const parsed = parseRecordCurrent([
      {
        presence: "logged_out",
        logout_time: new Date("2026-09-21T11:55:09.000Z"),
        server_now: NOW,
        attempt_id: 12,
        state: "valid",
        reason: null,
        duration_seconds: 300,
        grace_seconds: 10,
        started_at: STARTED,
        final_logout_at: new Date("2026-09-21T11:55:09.000Z"),
        stopped_at: new Date("2026-09-21T11:56:00.000Z"),
        elapsed_ms: 309000,
        gained: 123450,
        board_rank: 3,
      },
    ]);

    expect(parsed.attempt).toEqual({
      id: 12,
      state: "valid",
      reason: null,
      durationSeconds: 300,
      graceSeconds: 10,
      startedAt: STARTED.toISOString(),
      finalLogoutAt: "2026-09-21T11:55:09.000Z",
      stoppedAt: "2026-09-21T11:56:00.000Z",
      elapsedMs: 309000,
      gainedValue: 123450,
      boardRank: 3,
    });
  });

  it("refuses a presence or state nobody documented, and an attempt with no window", () => {
    expect(() => parseRecordCurrent([{ presence: "afk", server_now: NOW }])).toThrow(/presence/);
    expect(() => parseRecordCurrent([{ presence: "never", server_now: null }])).toThrow(/server_now/);
    expect(() =>
      parseRecordCurrent([{ presence: "never", server_now: NOW, attempt_id: 1, state: "running", duration_seconds: 300 }]),
    ).toThrow(/window/);
  });
});

describe("the list parsers", () => {
  it("read history, skills, the board and the durations", () => {
    expect(
      parseRecordHistoryRow({
        attempt_id: 4,
        state: "rejected",
        reason: "over_time",
        duration_seconds: 300,
        started_at: STARTED,
        elapsed_ms: 311000,
        gained: 1000000,
      }),
    ).toEqual({
      id: 4,
      state: "rejected",
      reason: "over_time",
      durationSeconds: 300,
      startedAt: STARTED.toISOString(),
      elapsedMs: 311000,
      gainedValue: 1000000,
    });

    expect(parseRecordSkillRow({ category: 9, start_xp: 300000, end_xp: 312345, gained: 12345 })).toEqual({
      category: 9,
      startValue: 300000,
      endValue: 312345,
      gainedValue: 12345,
    });
    expect(parseRecordSkillRow({ category: 1, start_xp: 5, end_xp: null, gained: null }).gainedValue).toBeNull();

    expect(
      parseRecordBoardRow({ rank: 1, username: "rakemage", gained: 20000, elapsed_ms: 300000, achieved_at: NOW }),
    ).toEqual({ rank: 1, username: "rakemage", gainedValue: 20000, elapsedMs: 300000, achievedAt: NOW.toISOString() });

    expect(parseRecordDurationRow({ duration_seconds: 300, grace_seconds: 10 })).toEqual({ seconds: 300, graceSeconds: 10 });
  });

  it("throw on a malformed row rather than render a hole", () => {
    expect(() => parseRecordHistoryRow({ attempt_id: 4, state: "valid" })).toThrow();
    expect(() => parseRecordSkillRow({ category: "9", start_xp: 1 })).toThrow();
    expect(() => parseRecordBoardRow({ rank: 1, username: "", gained: 1, elapsed_ms: 1, achieved_at: NOW })).toThrow();
    expect(() => parseRecordDurationRow({ duration_seconds: 300 })).toThrow();
  });
});

describe("recordStatusFor", () => {
  it("maps every SQL answer to a status, and 500 for anything else", () => {
    for (const result of [...START_RESULTS, ...STOP_RESULTS]) {
      expect(RECORD_STATUS[result], result).toBeDefined();
    }
    expect(recordStatusFor("ok")).toBe(200);
    expect(recordStatusFor("logged_in")).toBe(409);
    expect(recordStatusFor("too_many")).toBe(429);
    expect(recordStatusFor("staff")).toBe(403);
    expect(recordStatusFor("what")).toBe(500);
  });
});
