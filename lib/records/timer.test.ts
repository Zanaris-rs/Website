import { describe, expect, it } from "vitest";

import { POLL_MS, WARNING_SECONDS, clockOffset, logoutStanding, pollDelay, timerAt } from "./timer";

const STARTED = "2026-09-21T12:00:00.000Z";
const T0 = Date.parse(STARTED);

describe("timerAt", () => {
  it("counts down five minutes from the stored start", () => {
    expect(timerAt(STARTED, 300, 10, 0, T0)).toEqual({ phase: "running", leftMs: 300000, graceLeftMs: 310000 });
    expect(timerAt(STARTED, 300, 10, 0, T0 + 60_000).leftMs).toBe(240000);
  });

  it("warns in the last fifteen seconds, and not before", () => {
    expect(timerAt(STARTED, 300, 10, 0, T0 + (300 - WARNING_SECONDS - 1) * 1000).phase).toBe("running");
    expect(timerAt(STARTED, 300, 10, 0, T0 + (300 - WARNING_SECONDS) * 1000).phase).toBe("warning");
    expect(timerAt(STARTED, 300, 10, 0, T0 + 299_999).phase).toBe("warning");
  });

  it("is in the grace from 0:00 until ten seconds past, then over", () => {
    expect(timerAt(STARTED, 300, 10, 0, T0 + 300_000)).toEqual({ phase: "grace", leftMs: 0, graceLeftMs: 10000 });
    expect(timerAt(STARTED, 300, 10, 0, T0 + 310_000).phase).toBe("grace");
    expect(timerAt(STARTED, 300, 10, 0, T0 + 310_001)).toEqual({ phase: "over", leftMs: 0, graceLeftMs: 0 });
  });

  it("runs on the server's clock, whatever the browser's says", () => {
    // A browser ten minutes fast: its now reads T0 + 10m + 30s, the server's
    // reads T0 + 30s, so the offset is -10m and the timer shows 4:30 left.
    const fast = 10 * 60_000;
    const offset = clockOffset(new Date(T0 + 30_000).toISOString(), T0 + fast + 30_000);
    expect(offset).toBe(-fast);
    expect(timerAt(STARTED, 300, 10, offset, T0 + fast + 30_000).leftMs).toBe(270000);
  });

  it("treats an unreadable server time as no offset rather than NaN", () => {
    expect(clockOffset("not a date", T0)).toBe(0);
  });
});

describe("logoutStanding", () => {
  it("is null while the player is in the game, or has not logged out since Start", () => {
    expect(logoutStanding(STARTED, 300, 10, "logged_in", new Date(T0 + 100_000).toISOString())).toBeNull();
    expect(logoutStanding(STARTED, 300, 10, "logged_out", new Date(T0 - 60_000).toISOString())).toBeNull();
    expect(logoutStanding(STARTED, 300, 10, "logged_out", null)).toBeNull();
  });

  it("says a logout inside the window and its grace is in time, and one past it is not", () => {
    expect(logoutStanding(STARTED, 300, 10, "logged_out", new Date(T0 + 304_000).toISOString())).toEqual({
      elapsedMs: 304000,
      inTime: true,
    });
    expect(logoutStanding(STARTED, 300, 10, "syncing", new Date(T0 + 310_000).toISOString())?.inTime).toBe(true);
    expect(logoutStanding(STARTED, 300, 10, "logged_out", new Date(T0 + 310_001).toISOString())?.inTime).toBe(false);
  });
});

describe("pollDelay", () => {
  it("polls every five seconds while visible and never while hidden", () => {
    expect(POLL_MS).toBe(5000);
    expect(pollDelay(false)).toBe(5000);
    expect(pollDelay(true)).toBeNull();
  });
});
