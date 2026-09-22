import { describe, expect, it } from "vitest";

import { CATEGORIES } from "@/lib/hiscores/categories";

import {
  BOARD_CACHE_CONTROL,
  boardHref,
  parseBoardParams,
  parseBoardResponse,
  parseRecordCurrentResponse,
  toBoardResponse,
} from "./api";
import { RECORD_DURATIONS } from "./durations";
import type { RecordCurrentRow } from "./queries";

const q = (search: string) => new URLSearchParams(search);

describe("parseBoardParams", () => {
  it("defaults to the 5-minute Overall board", () => {
    expect(parseBoardParams(q(""))).toEqual({ ok: true, value: { durationSeconds: 300, category: 0 } });
  });

  it("accepts every hiscore category and every duration we run", () => {
    for (const category of CATEGORIES) {
      expect(parseBoardParams(q(`category=${category.id}`))).toEqual({
        ok: true,
        value: { durationSeconds: 300, category: category.id },
      });
    }
    for (const duration of RECORD_DURATIONS) {
      expect(parseBoardParams(q(`duration=${duration.seconds}`)).ok).toBe(true);
    }
  });

  it("refuses the disabled stats, junk and durations we do not run", () => {
    expect(parseBoardParams(q("category=19"))).toEqual({ ok: false, error: "bad_category" });
    expect(parseBoardParams(q("category=-1"))).toEqual({ ok: false, error: "bad_category" });
    expect(parseBoardParams(q("category=1e3"))).toEqual({ ok: false, error: "bad_category" });
    expect(parseBoardParams(q("duration=60"))).toEqual({ ok: false, error: "bad_duration" });
    expect(parseBoardParams(q("duration=abc"))).toEqual({ ok: false, error: "bad_duration" });
  });
});

describe("boardHref", () => {
  it("leaves the defaults out and round-trips the rest", () => {
    expect(boardHref({ durationSeconds: 300, category: 0 })).toBe("/hiscores/records");
    expect(boardHref({ durationSeconds: 300, category: 9 })).toBe("/hiscores/records?category=9");

    const href = boardHref({ durationSeconds: 300, category: 21 });
    expect(parseBoardParams(new URL(href, "https://zanaris.rs").searchParams)).toEqual({
      ok: true,
      value: { durationSeconds: 300, category: 21 },
    });
  });
});

describe("the board response", () => {
  it("shows XP as players see it and survives the round trip", () => {
    const response = toBoardResponse(
      { durationSeconds: 300, category: 9 },
      [{ rank: 1, username: "the_inducted", gainedValue: 243009, elapsedMs: 301000, achievedAt: "2026-09-21T12:05:01.000Z" }],
      (username) => (username === "the_inducted" ? "The Inducted" : username),
    );

    expect(response.rows[0]).toEqual({
      rank: 1,
      username: "the_inducted",
      name: "The Inducted",
      xp: 24300,
      elapsedMs: 301000,
      achievedAt: "2026-09-21T12:05:01.000Z",
    });
    expect(parseBoardResponse(JSON.parse(JSON.stringify(response)))).toEqual(response);
  });

  it("throws on a malformed body", () => {
    expect(() => parseBoardResponse({ durationSeconds: 300, category: 0 })).toThrow(/rows/);
    expect(() =>
      parseBoardResponse({ durationSeconds: 300, category: 0, rows: [{ rank: 1, username: "a", name: "", xp: 1, elapsedMs: 1, achievedAt: "x" }] }),
    ).toThrow();
  });

  it("caches like the hiscores", () => {
    expect(BOARD_CACHE_CONTROL).toBe("public, s-maxage=60, stale-while-revalidate=600");
  });
});

describe("the current response", () => {
  it("round-trips a running attempt and a player with none", () => {
    const running: RecordCurrentRow = {
      presence: "logged_in",
      logoutTime: "2026-09-21T11:59:00.000Z",
      serverNow: "2026-09-21T12:01:00.000Z",
      attempt: {
        id: 5,
        state: "running",
        reason: null,
        durationSeconds: 300,
        graceSeconds: 10,
        startedAt: "2026-09-21T12:00:00.000Z",
        finalLogoutAt: null,
        stoppedAt: null,
        elapsedMs: null,
        gainedValue: null,
        boardRank: null,
      },
    };
    expect(parseRecordCurrentResponse(JSON.parse(JSON.stringify(running)))).toEqual(running);

    const none: RecordCurrentRow = { presence: "never", logoutTime: null, serverNow: "2026-09-21T12:01:00.000Z", attempt: null };
    expect(parseRecordCurrentResponse(JSON.parse(JSON.stringify(none)))).toEqual(none);
  });

  it("throws on a presence or state nobody documented", () => {
    expect(() =>
      parseRecordCurrentResponse({ presence: "afk", logoutTime: null, serverNow: "2026-09-21T12:01:00.000Z", attempt: null }),
    ).toThrow(/presence/);
  });
});
