import { describe, expect, it } from "vitest";

import { decodeStream } from "./decode";
import { measure } from "./metrics";
import {
  buildCapture,
  curvedPathStream,
  fixedPeriodStream,
  humanStream,
  throttledStream,
  touchStream,
} from "./reference-encoder";
import { adjudicate } from "./verdict";

/**
 * Five streams, written through the reference encoder and judged end to end.
 *
 * This is the test that matters: everything else proves a number, and this
 * proves the number is worth banning somebody over. Each stream goes through
 * the whole pipeline a report does — client encoding, engine framing, base64,
 * decoder, metrics, verdict — and the expected answer is the one a moderator
 * should get.
 *
 * Two of them are here to *fail* to convict. A phone taps with no cursor
 * between taps and a background tab samples the mouse once a second; both look
 * exactly like a program to a naive spatial signal, and neither is one.
 */

function judge(rows: ReturnType<typeof humanStream>) {
  const stream = decodeStream(rows);
  const metrics = measure(stream);
  return { stream, metrics, verdict: adjudicate(metrics, stream) };
}

describe("somebody playing", () => {
  it("reads as human", () => {
    const { verdict, metrics } = judge(humanStream());

    expect(verdict.verdict).toBe("human");
    expect(verdict.headline).toBe("Human-like");
    // The evidence behind the verdict, so a threshold moved by accident shows
    // up as a changed number rather than as a silently different judgement.
    expect(metrics.clicks).toBeGreaterThanOrEqual(60);
    expect(metrics.intervalCv).toBeGreaterThan(0.2);
    expect(metrics.movesPerClick).toBeGreaterThan(6);
    expect(metrics.teleportShare).toBeLessThan(0.2);
    expect(metrics.unfocusedClicks).toBe(0);
  });
});

describe("a script with a sleep in it", () => {
  it("is likely macro on the timing and the cursor together", () => {
    const { verdict, metrics } = judge(fixedPeriodStream());

    expect(verdict.verdict).toBe("macro");
    expect(verdict.headline).toBe("Likely macro");
    expect(metrics.intervalCv).toBe(0);
    expect(metrics.modalShare).toBe(1);
    expect(metrics.constantRun).toBeGreaterThanOrEqual(50);
    expect(metrics.cellSd).toBe(0);

    const timing = verdict.families.find((f) => f.family === "timing");
    const spatial = verdict.families.find((f) => f.family === "spatial");
    expect(timing?.botLike).toBeGreaterThanOrEqual(2);
    expect(spatial?.botLike).toBeGreaterThanOrEqual(1);
    // And the headline is the family verdict, never a count of signals.
    expect(verdict.headline).not.toMatch(/\d+ of \d+/);
  });
});

describe("a script that draws a curve to each target", () => {
  it("is still likely macro: the cursor is human and the clock is not", () => {
    const { verdict, metrics } = judge(curvedPathStream());

    expect(verdict.verdict).toBe("macro");
    // The point of this stream: the spatial signal it was written to defeat
    // says "human", and it is convicted anyway.
    expect(metrics.straightShare).toBeLessThan(0.6);
    expect(metrics.intervalCv).toBeLessThan(0.08);
  });
});

describe("a phone", () => {
  it("never exceeds Review, however cursor-less the stream is", () => {
    const { verdict, metrics } = judge(touchStream());

    expect(verdict.touchLike).toBe(true);
    expect(verdict.verdict).toBe("review");
    // Both of the signals that make it look mechanical are real: there is no
    // cursor between taps, and every tap arrives out of nowhere. Neither is
    // evidence of a program, because a finger does exactly that.
    expect(metrics.movesPerClick).toBeLessThan(1.5);
    expect(metrics.teleportShare).toBeGreaterThan(0.5);
    expect(metrics.intervalCv).toBeGreaterThan(0.2);
  });
});

describe("a background tab", () => {
  it("reads as human, with the spatial family withheld", () => {
    const { verdict, stream, metrics } = judge(throttledStream());

    expect(stream.flags).toContain("throttled");
    expect(verdict.spatialWithheld).toBe("throttled tab");
    expect(verdict.verdict).toBe("human");

    // The mouse sampler ran at a twentieth of its rate, so the cursor signals
    // all read as mechanical — and every one of them is excluded.
    expect(metrics.movesPerClick).toBeLessThan(2);
    const spatial = verdict.families.find((f) => f.family === "spatial");
    expect(spatial?.evaluated).toBe(false);
    expect(spatial?.botLike).toBe(0);
    for (const signal of verdict.signals) {
      if (signal.family === "spatial") expect(signal.counted).toBe(false);
    }
  });
});

describe("the focus rule", () => {
  it("convicts on a single click into an unfocused window", () => {
    // Everything else about this stream is the human one. The only difference
    // is that the applet said it had lost focus and the clicks kept coming.
    const rows = buildCapture({
      samples: Array.from({ length: 400 }, (_, i) => ({
        at: i * 50,
        x: 300 + (i % 40),
        y: 200 + ((i * 7) % 40),
      })),
      clicks: [
        { at: 4000, x: 310, y: 210 },
        { at: 6000, x: 320, y: 240 },
      ],
      focus: [{ at: 3000, focus: 0 }],
    });

    const { verdict, metrics } = judge(rows);
    expect(metrics.unfocusedClicks).toBe(2);
    expect(verdict.verdict).toBe("macro");
    expect(verdict.reason).toMatch(/focus/);
  });

  it("assumes the applet had focus until the client says otherwise", () => {
    // The client only reports *changes*, so a capture that opens mid-session
    // carries no focus record at all. Assuming focus is the safe reading: the
    // other way round would convict every capture that began quietly.
    const rows = buildCapture({
      samples: Array.from({ length: 100 }, (_, i) => ({
        at: i * 50,
        x: 300 + i,
        y: 200,
      })),
      clicks: [{ at: 2000, x: 340, y: 200 }],
    });
    const { metrics } = judge(rows);
    expect(metrics.unfocusedClicks).toBe(0);
  });
});

describe("nothing to go on", () => {
  it("says so rather than clearing the player", () => {
    const { verdict } = judge(
      buildCapture({
        samples: [{ at: 0, x: 100, y: 100 }],
        clicks: [{ at: 50, x: 100, y: 100 }],
      }),
    );
    expect(verdict.verdict).toBe("insufficient");
    expect(verdict.headline).toBe("Not enough data");
    expect(verdict.reason).toMatch(/chat and the wealth events/);
  });

  it("says so for an empty capture too", () => {
    const { verdict } = judge([]);
    expect(verdict.verdict).toBe("insufficient");
  });
});

describe("the Java client", () => {
  it("has its cursor signals withheld and its clock judged", () => {
    const rows = fixedPeriodStream().map((row) => ({ ...row, client: "java" }));
    const { verdict } = judge(rows);

    expect(verdict.spatialWithheld).toBe("java client");
    // Three bot-like timing signals is still three signals across the families
    // that were evaluated, so a Java macro is not immune — it is only judged
    // on the half of the evidence its packets can carry.
    expect(verdict.verdict).toBe("macro");
    const spatial = verdict.families.find((f) => f.family === "spatial");
    expect(spatial?.evaluated).toBe(false);
  });
});

describe("every signal", () => {
  it("names the false positive that stops it being a proof", () => {
    const { verdict } = judge(humanStream());
    expect(verdict.signals).toHaveLength(11);
    for (const signal of verdict.signals) {
      expect(signal.falsePositive.length).toBeGreaterThan(40);
      expect(signal.label.length).toBeGreaterThan(0);
      expect(["timing", "spatial", "focus"]).toContain(signal.family);
    }
  });
});
