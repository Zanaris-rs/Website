import { describe, expect, it } from "vitest";

import { DEFAULT_DURATION } from "./durations";
import {
  PRESENCES,
  RECORD_REASONS,
  RECORD_STATES,
  START_RESULTS,
  STOP_RESULTS,
} from "./queries";
import {
  FINISHES,
  HISTORY_LABELS,
  MESSAGES,
  PRESENCE_LINES,
  RULE_STEPS,
  RULE_TIMING,
  START_LABEL,
  STOP_LABEL,
  blockedFrom,
  messageFor,
  ruleText,
  verdictFor,
} from "./verdict";

describe("every code has a sentence", () => {
  it("covers every refusal the SQL and the routes can answer", () => {
    const codes = [
      ...START_RESULTS,
      ...STOP_RESULTS,
      "not_running",
      "session_expired",
      "origin",
      "unavailable",
    ].filter((code) => code !== "ok");

    for (const code of codes) {
      expect(MESSAGES[code], code).toBeTruthy();
    }
    expect(messageFor("something new")).toBe(MESSAGES.unavailable);
  });

  it("covers every presence", () => {
    for (const presence of PRESENCES) {
      expect(PRESENCE_LINES[presence], presence).toBeTruthy();
    }
  });

  it("covers every finish migration 8 can store, and only those", () => {
    // The pairs the migration's CHECK constraints and record_stop allow. A new
    // reason added in SQL must be added here and given copy, or this fails.
    const stored = FINISHES.map(([state, reason]) => `${state}:${reason ?? ""}`).sort();
    expect(stored).toEqual(
      [
        "valid:",
        "rejected:over_time",
        "rejected:no_session",
        "void:no_clean_logout",
        "abandoned:player",
        "abandoned:not_stopped",
      ].sort(),
    );

    // Every reason the schema allows is used by some finish.
    for (const reason of RECORD_REASONS) {
      expect(FINISHES.some(([, r]) => r === reason), reason).toBe(true);
    }

    for (const [state, reason] of FINISHES) {
      const verdict = verdictFor(
        { state, reason, elapsedMs: 304000, gainedValue: 274000, boardRank: 3 },
        DEFAULT_DURATION,
      );
      expect(verdict.title, `${state}/${reason}`).toBeTruthy();
      expect(verdict.lines.length, `${state}/${reason}`).toBeGreaterThan(0);
      expect(HISTORY_LABELS[`${state}:${reason ?? ""}`], `${state}/${reason}`).toBeTruthy();
    }

    for (const state of RECORD_STATES) {
      expect(HISTORY_LABELS[`${state}:`] ?? FINISHES.some(([s]) => s === state), state).toBeTruthy();
    }
  });

  it("throws on a finish nobody wrote copy for", () => {
    expect(() =>
      verdictFor({ state: "void", reason: "over_time", elapsedMs: 1, gainedValue: 1, boardRank: null }, DEFAULT_DURATION),
    ).toThrow(/no copy/);
  });
});

describe("verdictFor", () => {
  it("shows the gain, the actual time and the board position for a record", () => {
    const verdict = verdictFor(
      { state: "valid", reason: null, elapsedMs: 304000, gainedValue: 274000, boardRank: 3 },
      DEFAULT_DURATION,
    );
    expect(verdict.tone).toBe("good");
    expect(verdict.title).toBe("+27,400 XP in 5:04");
    expect(verdict.lines).toEqual(["You're 3rd on the 5-minute Overall board."]);
  });

  it("says plainly when nothing was gained", () => {
    const verdict = verdictFor(
      { state: "valid", reason: null, elapsedMs: 290000, gainedValue: 0, boardRank: null },
      DEFAULT_DURATION,
    );
    expect(verdict.tone).toBe("neutral");
    expect(verdict.title).toBe("No XP gained");
  });

  it("names the logout time, the window and the grace for an over-time attempt", () => {
    const verdict = verdictFor(
      { state: "rejected", reason: "over_time", elapsedMs: 341000, gainedValue: 310000, boardRank: null },
      DEFAULT_DURATION,
    );
    expect(verdict.tone).toBe("bad");
    expect(verdict.title).toBe("Over time: +31,000 XP in 5:41");
    expect(verdict.lines[0]).toBe("You logged out at 5:41 — past the 5:00 window and its 10-second grace.");
    expect(verdict.lines.join(" ")).toContain("nowhere else");
  });

  it("owns our failures, and says they cost the player nothing", () => {
    const verdict = verdictFor(
      { state: "void", reason: "no_clean_logout", elapsedMs: null, gainedValue: null, boardRank: null },
      DEFAULT_DURATION,
    );
    expect(verdict.tone).toBe("ours");
    expect(verdict.title).toContain("on us");
    expect(verdict.lines.join(" ")).toContain("doesn't count against your starts");
  });
});

describe("the rules", () => {
  it("are four steps: log out, Start record, log out by 0:00, Stop record before logging in", () => {
    expect(RULE_STEPS.map(ruleText)).toEqual([
      "Log out of the game and enter your username and password ready to begin your record.",
      "Press Start record and log into the game and begin your record.",
      "YOU must log out before the timer reaches 0:00.",
      "Press Stop record before you log in again.",
    ]);
  });

  it("name the buttons by the labels the buttons wear", () => {
    const buttons = [...RULE_STEPS, RULE_TIMING].flatMap((line) =>
      line.flatMap((part) => (typeof part === "string" ? [] : [part.button])),
    );
    expect(new Set(buttons)).toEqual(new Set([START_LABEL, STOP_LABEL]));
  });

  it("say the window runs from Start record to the last logout, login included", () => {
    const timing = ruleText(RULE_TIMING);
    expect(timing).toContain("from pressing Start record to your last logout");
    expect(timing).toContain("log in count too");
    expect(timing).toContain("press Stop record does not count");
  });
});

describe("blockedFrom", () => {
  const NOW = Date.parse("2026-09-21T12:00:00Z");

  it("blocks staff above level 1, as the hiscores do", () => {
    expect(blockedFrom({ staffModLevel: 2, bannedUntil: null }, NOW)).toBe("staff");
    expect(blockedFrom({ staffModLevel: 1, bannedUntil: null }, NOW)).toBeNull();
  });

  it("blocks a ban that is still running, and not one that has ended", () => {
    expect(blockedFrom({ staffModLevel: 0, bannedUntil: "2026-09-22T00:00:00Z" }, NOW)).toBe("banned");
    expect(blockedFrom({ staffModLevel: 0, bannedUntil: "2026-09-20T00:00:00Z" }, NOW)).toBeNull();
  });
});
