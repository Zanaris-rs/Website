import { describe, expect, it } from "vitest";

import type { InputStream } from "./decode";
import { MARKER_FLOOD_CAP, base64ToBytes, decodeStream } from "./decode";
import type { Metrics } from "./metrics";
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
 * Three of them are here to *fail* to convict. A phone taps with no cursor
 * between taps and a background tab samples the mouse once a second; both look
 * exactly like a program to a naive spatial signal, and neither is one. And
 * the curved-path script — which really is a program — reaches Review rather
 * than Likely macro, because everything mechanical about it is the clock, and
 * one family agreeing with itself three times is one observation.
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
  it("reaches Review and no further: one family cannot convict alone", () => {
    const { verdict, metrics } = judge(curvedPathStream());

    // This stream was written to defeat the cursor signals, and it does: every
    // spatial signal reads human, and the three that read mechanical are the
    // three timing ones — which are three ways of noticing one thing. A fixed
    // click interval makes the spread zero, the commonest interval 100% and
    // the unbroken run as long as the capture, and calling that three
    // agreeing observations is the double-count the families exist to stop.
    expect(metrics.straightShare).toBeLessThan(0.6);
    expect(metrics.intervalCv).toBeLessThan(0.08);

    const timing = verdict.families.find((f) => f.family === "timing");
    const spatial = verdict.families.find((f) => f.family === "spatial");
    expect(timing?.botLike).toBe(3);
    expect(spatial?.evaluated).toBe(true);
    expect(spatial?.botLike).toBe(0);

    // So the honest answer is "watch them, or capture again", not a ban. A
    // script this careful is caught by a second capture — a person's rhythm
    // does not survive one, let alone two.
    expect(verdict.verdict).toBe("review");
    expect(verdict.headline).toBe("Review");
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

  it("is withheld when the capture lost records, and holds the verdict", () => {
    // The same stream as above — focus lost, and the clicks keep coming — with
    // one difference: the ring hit its flood cap between the two, so records
    // were thrown away. One of them may well have been the "focus regained"
    // the client sent when the player clicked back into the window, and a
    // decoder cannot tell that from a window nobody returned to.
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
      markers: [{ at: 3500, reason: MARKER_FLOOD_CAP }],
    });

    const { verdict, stream, metrics } = judge(rows);
    expect(stream.flags).toContain("flooded");

    // The clicks are still counted and still shown: what changes is that they
    // no longer decide anything.
    expect(metrics.unfocusedClicks).toBe(2);
    expect(verdict.focusWithheld).toBe("a flood cap");
    expect(verdict.verdict).not.toBe("macro");

    const focus = verdict.families.find((f) => f.family === "focus");
    expect(focus?.evaluated).toBe(false);
    expect(focus?.botLike).toBe(0);
    for (const signal of verdict.signals) {
      if (signal.family === "focus") expect(signal.counted).toBe(false);
    }
  });

  it("holds a truncated capture at Review however mechanical it reads", () => {
    // A macro caught in the act, in a capture whose last record ran off the
    // end of the bytes. Every timing and cursor signal still convicts; the
    // verdict does not, because half a session is not a session.
    const rows = fixedPeriodStream();
    const last = rows[rows.length - 1];
    const bytes = base64ToBytes(last.data);
    const cut = { ...last, data: btoa(String.fromCharCode(...bytes.slice(0, -1))) };

    const { verdict, stream } = judge([...rows.slice(0, -1), cut]);
    expect(stream.flags).toContain("truncated");
    expect(verdict.focusWithheld).toBe("a truncated record");
    expect(verdict.verdict).toBe("review");
    expect(verdict.reason).toMatch(/Held at Review/);
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
  it("has its cursor signals withheld, and its clock alone is Review", () => {
    const rows = fixedPeriodStream().map((row) => ({ ...row, client: "java" }));
    const { verdict } = judge(rows);

    expect(verdict.spatialWithheld).toBe("java client");
    const spatial = verdict.families.find((f) => f.family === "spatial");
    expect(spatial?.evaluated).toBe(false);

    // The same script on the web client is Likely macro, because its cursor is
    // measurable and it convicts itself. The Java client's packets carry at
    // most one move record each, so the only family left to read is the clock
    // — and one family is Review whatever it says. This is the cost of not
    // double-counting: a Java macro is convicted by an unfocused click, or by
    // a moderator watching, and not by three views of one interval.
    const timing = verdict.families.find((f) => f.family === "timing");
    expect(timing?.botLike).toBe(3);
    expect(verdict.verdict).toBe("review");
  });
});

/**
 * The ≥3 rule, on its own. None of the five streams reaches the verdict by
 * this route — the fixed-period script is caught by the timing-and-cursor rule
 * before it gets here — so it is asserted against a `Metrics` written by hand
 * rather than against an encoded stream, which is also the only way to say
 * "one bot-like timing signal and two spatial ones" precisely.
 */
const NOTHING_MECHANICAL: Metrics = {
  clicks: 400,
  moveSamples: 4_000,
  placedSamples: 4_000,
  durationMs: 600_000,
  intervals: 399,
  intervalCv: 0.5,
  intervalMeanMs: 1_400,
  modalIntervalMs: 600,
  modalShare: 0.1,
  constantRun: 4,
  idleGaps: 9,
  idleGapCv: 0.6,
  distinctPositions: 380,
  samePixelShare: 0.05,
  cellClicks: 20,
  cellSd: 5,
  decidableClicks: 380,
  teleports: 10,
  teleportShare: 0.03,
  movesPerClick: 10,
  latencies: 300,
  stillnessMs: 220,
  stillnessCv: 0.5,
  paths: 200,
  straightPaths: 20,
  straightShare: 0.1,
  pathSpeedCv: 0.4,
  unfocusedClicks: 0,
  focusChanges: 2,
};

const CLEAN_STREAM: InputStream = {
  events: [],
  flags: [],
  chunks: 1,
  ringChunks: 1,
  liveChunks: 0,
  clients: ["web"],
  from: 0,
  to: 600_000,
  liveFrom: null,
};

describe("three bot-like signals", () => {
  it("convict when they span two families", () => {
    // One mechanical clock signal, two mechanical cursor signals: three
    // observations that are genuinely of different things.
    const verdict = adjudicate(
      {
        ...NOTHING_MECHANICAL,
        constantRun: 40,
        samePixelShare: 0.9,
        teleportShare: 0.7,
      },
      CLEAN_STREAM,
    );
    expect(verdict.verdict).toBe("macro");
    expect(verdict.reason).toContain("2 families");
  });

  it("do not when they are three views of one family", () => {
    // The same count, all of it the clock. This is the curved-path script, and
    // the whole reason the signals are grouped.
    const verdict = adjudicate(
      {
        ...NOTHING_MECHANICAL,
        intervalCv: 0,
        modalShare: 1,
        constantRun: 40,
      },
      CLEAN_STREAM,
    );
    const timing = verdict.families.find((f) => f.family === "timing");
    expect(timing?.botLike).toBe(3);
    expect(verdict.verdict).toBe("review");
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
