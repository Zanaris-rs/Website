import { describe, expect, it } from "vitest";

import type { InputStream, StreamEvent } from "./decode";
import { decodeStream } from "./decode";
import {
  MIN_CLICKS_FOR_TIMING,
  MIN_INTERVALS_FOR_RUNS,
  STRAIGHT_RATIO,
  TELEPORT_JUMP_PX,
  measure,
} from "./metrics";
import { buildCapture } from "./reference-encoder";

/**
 * Each measurement on its own, against a stream small enough to check by hand.
 *
 * `measure` takes a decoded stream, so these build one directly rather than
 * going through the encoder: what is under test here is the arithmetic, and a
 * test that had to encode forty samples to prove a mean would be proving the
 * encoder instead.
 */

function stream(events: StreamEvent[], flags: InputStream["flags"] = []): InputStream {
  const times = events.map((event) => event.at);
  return {
    events,
    flags,
    chunks: 1,
    ringChunks: 1,
    liveChunks: 0,
    clients: ["web"],
    from: times.length > 0 ? Math.min(...times) : null,
    to: times.length > 0 ? Math.max(...times) : null,
    liveFrom: null,
  };
}

function click(at: number, delta: number, x = 100, y = 100): StreamEvent {
  return { type: "click", t: at, at, delta, button: 0, x, y, seq: 0, live: false };
}

function move(at: number, x: number, y: number): StreamEvent {
  return { type: "move", t: at, at, delta: 0, x, y, seq: 0, live: false };
}

function clicksEvery(count: number, deltaSamples: number): StreamEvent[] {
  return Array.from({ length: count }, (_, i) =>
    click(i * deltaSamples * 50, i === 0 ? 4095 : deltaSamples),
  );
}

describe("click intervals", () => {
  it("come from the client's own delta, not from the event times", () => {
    // The engine can only date a click to the nearest 600 ms tick. These
    // clicks are all dated to the same instant on purpose: the intervals must
    // still come out as 1000 ms, because the client measured them.
    const events = Array.from({ length: 40 }, (_, i) =>
      i === 0 ? click(0, 4095) : click(0, 20),
    );
    const metrics = measure(stream(events));
    expect(metrics.intervalMeanMs).toBe(1000);
    expect(metrics.intervalCv).toBe(0);
  });

  it("drop the saturated delta, which is not a measurement", () => {
    // 4095 means "at least 205 seconds since the last click" — the value the
    // client writes for the first click of a session, among other things.
    const metrics = measure(stream(clicksEvery(40, 20)));
    expect(metrics.clicks).toBe(40);
    expect(metrics.intervals).toBe(39);
  });

  it("need thirty of them before the spread means anything", () => {
    const few = measure(stream(clicksEvery(MIN_CLICKS_FOR_TIMING, 20)));
    expect(few.intervals).toBe(MIN_CLICKS_FOR_TIMING - 1);
    expect(few.intervalCv).toBeNull();

    const enough = measure(stream(clicksEvery(MIN_CLICKS_FOR_TIMING + 1, 20)));
    expect(enough.intervalCv).toBe(0);
  });

  it("need fifty before an unbroken rhythm means anything", () => {
    const few = measure(stream(clicksEvery(MIN_INTERVALS_FOR_RUNS, 20)));
    expect(few.constantRun).toBeNull();
    const enough = measure(stream(clicksEvery(MIN_INTERVALS_FOR_RUNS + 1, 20)));
    expect(enough.constantRun).toBe(MIN_INTERVALS_FOR_RUNS);
  });

  it("separate a pause from a rhythm at five seconds", () => {
    const events: StreamEvent[] = [click(0, 4095)];
    for (let i = 1; i <= 40; i++) {
      // Every fifth click comes after a two-minute break.
      events.push(click(i * 1000, i % 5 === 0 ? 2400 : 20));
    }
    const metrics = measure(stream(events));
    expect(metrics.idleGaps).toBe(8);
    expect(metrics.intervals).toBe(32);
    // The breaks are identical, so the gap spread is zero — which is a signal
    // in its own right and must not be diluted into the click intervals.
    expect(metrics.idleGapCv).toBe(0);
  });

  it("counts one interval per modal value, not per click", () => {
    const events: StreamEvent[] = [click(0, 4095)];
    for (let i = 1; i <= 40; i++) events.push(click(i * 1000, i <= 30 ? 20 : 25));
    const metrics = measure(stream(events));
    expect(metrics.modalIntervalMs).toBe(1000);
    expect(metrics.modalShare).toBeCloseTo(30 / 40, 5);
  });
});

describe("where the clicks land", () => {
  it("counts a repeated pixel as repeated", () => {
    const events = Array.from({ length: 20 }, (_, i) =>
      click(i * 1000, 20, i < 15 ? 400 : 400 + i, 300),
    );
    const metrics = measure(stream(events));
    expect(metrics.distinctPositions).toBe(6);
    expect(metrics.samePixelShare).toBeCloseTo(1 - 6 / 20, 5);
  });

  it("measures the spread inside the busiest 16 px square", () => {
    // Twelve clicks on one exact pixel: no spread at all, which no hand does.
    const exact = measure(
      stream(Array.from({ length: 12 }, (_, i) => click(i * 1000, 20, 400, 300))),
    );
    expect(exact.cellClicks).toBe(12);
    expect(exact.cellSd).toBe(0);

    // The same twelve, scattered across the square.
    const spread = measure(
      stream(
        Array.from({ length: 12 }, (_, i) =>
          click(i * 1000, 20, 400 + (i % 4), 300 + (i % 3)),
        ),
      ),
    );
    expect(spread.cellSd).toBeGreaterThan(1);
  });

  it("needs ten clicks in the square before the spread is worth reading", () => {
    const metrics = measure(
      stream(Array.from({ length: 9 }, (_, i) => click(i * 1000, 20, 400, 300))),
    );
    expect(metrics.cellClicks).toBe(9);
    expect(metrics.cellSd).toBeNull();
  });
});

describe("how the cursor arrived", () => {
  it("counts a click the cursor reached in one long hop", () => {
    const events: StreamEvent[] = [];
    for (let i = 0; i < 12; i++) {
      const base = i * 2000;
      // Two samples: one far away, then the target. The hop into the click is
      // the whole journey, which is what a `moveTo` looks like.
      events.push(move(base + 100, 100, 100));
      events.push(move(base + 150, 500, 400));
      events.push(click(base + 200, 40, 500, 400));
    }
    const metrics = measure(stream(events));
    expect(metrics.decidableClicks).toBe(12);
    expect(metrics.teleportShare).toBe(1);
  });

  it("does not count a cursor that decelerated into the target", () => {
    const events: StreamEvent[] = [];
    for (let i = 0; i < 12; i++) {
      const base = i * 2000;
      events.push(move(base + 100, 495, 397));
      events.push(move(base + 150, 500, 400));
      events.push(click(base + 200, 40, 500, 400));
    }
    const metrics = measure(stream(events));
    expect(metrics.teleportShare).toBe(0);
    // The threshold is a speed at the moment of arrival, not a distance
    // travelled: 40 px in one 50 ms sample.
    expect(TELEPORT_JUMP_PX).toBe(40);
  });
});

describe("the path between clicks", () => {
  it("calls a drawn line a drawn line", () => {
    const events: StreamEvent[] = [];
    for (let leg = 0; leg < 8; leg++) {
      const base = leg * 3000;
      events.push(click(base, 60, 100, 100));
      for (let k = 1; k <= 10; k++) {
        events.push(move(base + k * 50, 100 + k * 30, 100 + k * 20));
      }
      events.push(click(base + 1000, 20, 400, 300));
    }
    const metrics = measure(stream(events));
    expect(metrics.paths).toBeGreaterThanOrEqual(8);
    expect(metrics.straightShare).toBe(1);
    expect(STRAIGHT_RATIO).toBe(0.98);
  });

  it("does not call an arc one", () => {
    const events: StreamEvent[] = [];
    for (let leg = 0; leg < 8; leg++) {
      const base = leg * 3000;
      events.push(click(base, 60, 100, 100));
      for (let k = 1; k <= 10; k++) {
        const u = k / 10;
        events.push(
          move(
            base + k * 50,
            Math.round(100 + u * 300),
            Math.round(100 + u * 200 - Math.sin(u * Math.PI) * 60),
          ),
        );
      }
      events.push(click(base + 1000, 20, 400, 300));
    }
    const metrics = measure(stream(events));
    expect(metrics.straightShare).toBe(0);
  });

  it("ignores a hop too short to say anything about a mouse", () => {
    const events: StreamEvent[] = [];
    for (let leg = 0; leg < 8; leg++) {
      const base = leg * 3000;
      events.push(click(base, 60, 100, 100));
      for (let k = 1; k <= 10; k++) events.push(move(base + k * 50, 100 + k, 100));
      events.push(click(base + 1000, 20, 110, 100));
    }
    const metrics = measure(stream(events));
    expect(metrics.paths).toBe(0);
    expect(metrics.straightShare).toBeNull();
  });
});

describe("focus", () => {
  it("counts clicks against the state in force, in record order", () => {
    const events: StreamEvent[] = [
      click(0, 20),
      { type: "focus", t: 100, at: 100, focus: 0, seq: 0, live: false },
      click(200, 20),
      click(400, 20),
      { type: "focus", t: 500, at: 500, focus: 1, seq: 0, live: false },
      click(600, 20),
    ];
    const metrics = measure(stream(events));
    expect(metrics.unfocusedClicks).toBe(2);
    expect(metrics.focusChanges).toBe(2);
  });
});

describe("a very long capture", () => {
  /**
   * Ten minutes of a fast script is a big stream, and this page is rendered on
   * the server for a moderator who is waiting for it.
   *
   * The number that matters is not the constant: it is the *shape*. Reading
   * the cursor's path between two clicks by filtering the whole move array is
   * quadratic, and quadratic on a capture the ring is allowed to hold is a
   * page that never comes back. Both loops walk one moving index over arrays
   * that are already in time order, so this is linear and the assertion has
   * two orders of magnitude of room in it.
   */
  it("measures a 30,000-click stream in well under half a second", () => {
    const events: StreamEvent[] = [];
    let moves = 0;
    let longLegs = 0;

    for (let i = 0; i < 30_000; i++) {
      const at = i * 300;
      events.push(click(at, 6, 100 + (i % 600), 100 + (i % 400)));
      events.push(move(at + 50, 100 + (i % 600), 100 + (i % 400)));
      events.push(move(at + 100, 140 + (i % 600), 160 + (i % 400)));
      moves += 2;
      // Every seventeenth journey is long enough to be judged as a path, up to
      // the sample budget: a stream of nothing but two-sample hops would skip
      // the expensive half of the loop and prove nothing about it.
      if (i % 17 === 0 && longLegs < 1_750) {
        longLegs += 1;
        events.push(move(at + 150, 180 + (i % 600), 220 + (i % 400)));
        events.push(move(at + 200, 220 + (i % 600), 280 + (i % 400)));
        moves += 2;
      }
    }

    expect(events.length - moves).toBe(30_000);
    expect(moves).toBe(63_500);

    const long: InputStream = {
      events,
      flags: [],
      chunks: 1,
      ringChunks: 1,
      liveChunks: 0,
      clients: ["web"],
      from: events[0].at,
      to: events[events.length - 1].at,
      liveFrom: null,
    };

    const started = performance.now();
    const metrics = measure(long);
    const elapsed = performance.now() - started;

    expect(metrics.clicks).toBe(30_000);
    expect(metrics.moveSamples).toBe(63_500);
    // And it did the work rather than skipping it.
    expect(metrics.paths).toBeGreaterThan(1_000);
    expect(elapsed).toBeLessThan(500);
  });
});

describe("a stream with no cursor to place", () => {
  it("counts the samples but leaves them out of the path", () => {
    // A capture that opens mid-session: relative steps against a cursor
    // nobody has seen. They are real input — the mouse moved — but there is
    // no position to draw or measure.
    const rows = buildCapture({
      samples: Array.from({ length: 60 }, (_, i) => ({
        at: i * 50,
        x: 300 + i,
        y: 200,
      })),
      clicks: [{ at: 2000, x: 340, y: 200 }],
    });
    // Drop the first chunk, which is where the absolute step lives.
    const later = rows.slice(1);
    const decoded = decodeStream(later);
    const metrics = measure(decoded);
    expect(metrics.moveSamples).toBeGreaterThanOrEqual(metrics.placedSamples);
    if (decoded.flags.includes("unknown-cursor")) {
      expect(metrics.placedSamples).toBeLessThan(metrics.moveSamples);
    }
  });
});
