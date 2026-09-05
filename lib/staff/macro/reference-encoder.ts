import {
  CLICK_DELTA_MAX,
  MARKER_LIVE_TAIL_BEGINS,
  MOVE_DELTA_MAX,
  SAMPLE_MS,
  SCREEN_HEIGHT,
  SCREEN_WIDTH,
  TICK_MS,
  type InputChunkSource,
} from "./decode";

/**
 * The other half of the decoder, written so the tests can prove it.
 *
 * **Nothing on the site imports this file.** It exists because a decoder
 * tested only against a decoder's own idea of the bytes proves nothing: this
 * one mirrors `Client.ts:2061-2189` — the client's cursor state, its three
 * move encodings and the branch between them, its click word and its flush
 * rule — and `InputRing.ts`'s framing around them, so a stream can be written
 * as `(t, x, y, button, focus)` and read back as events.
 *
 * Two things it deliberately does not do: it never drops a move packet or
 * trips the flood cap (those are markers, and the fixture already pins them),
 * and it writes a time anchor by wall clock rather than by the world's tick
 * counter. The engine's anchor is "ticks since this chunk began", which for a
 * test is the same number.
 */

/* --- records --- */

export type EncodedStep = {
  /** 50 ms samples in which the cursor did not move. */
  delta: number;
  /** Relative move, used when `x`/`y` are absent. */
  dx?: number;
  dy?: number;
  /** Present makes the step absolute, as it is in the client when dx overflows. */
  x?: number;
  y?: number;
};

/**
 * A move payload, one step at a time.
 *
 * The branch is the client's: two bytes for a relative step while
 * `delta < 8` and both deltas fit in six bits, three for an absolute one under
 * the same delta, four when the delta has grown past it.
 */
export function encodeMovePayload(steps: readonly EncodedStep[]): Uint8Array {
  const out: number[] = [];

  for (const step of steps) {
    const absolute = step.x !== undefined && step.y !== undefined;

    if (!absolute) {
      const dx = step.dx ?? 0;
      const dy = step.dy ?? 0;
      if (step.delta >= 8 || dx < -32 || dx > 31 || dy < -32 || dy > 31) {
        throw new Error(
          "a relative step needs delta < 8 and both deltas in [-32, 31]",
        );
      }
      const word = (step.delta << 12) + ((dx + 32) << 6) + (dy + 32);
      out.push((word >> 8) & 0xff, word & 0xff);
      continue;
    }

    const pos = packPos(step.x as number, step.y as number);

    if (step.delta < 8) {
      const word = 0x800000 + (step.delta << 19) + pos;
      out.push((word >> 16) & 0xff, (word >> 8) & 0xff, word & 0xff);
      continue;
    }

    const word = (0xc0000000 + (step.delta << 19) + pos) >>> 0;
    out.push(
      (word >>> 24) & 0xff,
      (word >>> 16) & 0xff,
      (word >>> 8) & 0xff,
      word & 0xff,
    );
  }

  return Uint8Array.from(out);
}

function packPos(x: number, y: number): number {
  if (x === -1 && y === -1) return 0x7ffff;
  const cx = Math.min(Math.max(x, 0), SCREEN_WIDTH - 1);
  const cy = Math.min(Math.max(y, 0), SCREEN_HEIGHT - 1);
  return cy * SCREEN_WIDTH + cx;
}

/** `(delta << 20) | (button << 19) | (y * 765 + x)`, exactly as the client. */
export function encodeClickWord(
  delta: number,
  button: number,
  x: number,
  y: number,
): number {
  const capped = Math.min(delta, CLICK_DELTA_MAX);
  return ((capped << 20) + (button << 19) + packPos(x, y)) >>> 0;
}

export type ChunkRecord =
  | { kind: "anchor"; ticks: number }
  | { kind: "marker"; reason: number }
  | { kind: "focus"; focus: number }
  | { kind: "camera"; pitch: number; yaw: number }
  | { kind: "click"; word: number }
  | { kind: "move"; payload: Uint8Array };

/** The engine's framing, with the records given rather than derived. */
export function encodeChunk(records: readonly ChunkRecord[]): Uint8Array {
  const out: number[] = [];

  for (const record of records) {
    switch (record.kind) {
      case "camera":
        out.push(
          1,
          (record.pitch >> 8) & 0xff,
          record.pitch & 0xff,
          (record.yaw >> 8) & 0xff,
          record.yaw & 0xff,
        );
        break;
      case "focus":
        out.push(2, record.focus & 0xff);
        break;
      case "click":
        out.push(
          3,
          (record.word >>> 24) & 0xff,
          (record.word >>> 16) & 0xff,
          (record.word >>> 8) & 0xff,
          record.word & 0xff,
        );
        break;
      case "move":
        out.push(4, record.payload.length & 0xff, ...record.payload);
        break;
      case "anchor":
        out.push(5, (record.ticks >> 8) & 0xff, record.ticks & 0xff);
        break;
      case "marker":
        out.push(6, record.reason & 0xff);
        break;
    }
  }

  return Uint8Array.from(out);
}

/* --- the client's own loop --- */

export type CursorState = { x: number; y: number; delta: number };

/** Where the client's tracking starts at login: the origin, no delta. */
export function newCursorState(): CursorState {
  return { x: 0, y: 0, delta: 0 };
}

/**
 * One flush of `mouseTracking`, as `Client.ts` writes it: a step for every
 * sample where the cursor moved, and `mouseTrackDelta` counting the ones where
 * it did not. The state carries across packets, which is exactly why a capture
 * that starts mid-session cannot place the cursor until an absolute step.
 */
export function encodeSamples(
  samples: readonly { x: number; y: number }[],
  state: CursorState,
): Uint8Array {
  const steps: EncodedStep[] = [];

  for (const sample of samples) {
    const offscreen = sample.x === -1 && sample.y === -1;
    const x = offscreen ? -1 : Math.min(Math.max(sample.x, 0), SCREEN_WIDTH - 1);
    const y = offscreen
      ? -1
      : Math.min(Math.max(sample.y, 0), SCREEN_HEIGHT - 1);

    if (x === state.x && y === state.y) {
      if (state.delta < MOVE_DELTA_MAX) state.delta += 1;
      continue;
    }

    const dx = x - state.x;
    const dy = y - state.y;
    state.x = x;
    state.y = y;

    if (state.delta < 8 && dx >= -32 && dx <= 31 && dy >= -32 && dy <= 31) {
      steps.push({ delta: state.delta, dx, dy });
    } else {
      steps.push({ delta: state.delta, x, y });
    }
    state.delta = 0;
  }

  return encodeMovePayload(steps);
}

/* --- a whole capture --- */

export type ScriptSample = { at: number; x: number; y: number };
export type ScriptClick = {
  at: number;
  x: number;
  y: number;
  button?: number;
};
export type ScriptFocus = { at: number; focus: number };

export type Script = {
  /** Where the mouse was, one entry per client sample. */
  samples?: readonly ScriptSample[];
  clicks?: readonly ScriptClick[];
  focus?: readonly ScriptFocus[];
  /** Epoch ms of the first packet. */
  startedAt?: number;
  client?: string;
  /** The client flushes on a click or every 40 samples. */
  flushEvery?: number;
  /** Everything at or after this is a live chunk, opened with marker 4. */
  reportAt?: number;
};

type Packet = { at: number; record: ChunkRecord };

/**
 * A script turned into the rows `accounts.staff_report_input` would return.
 *
 * The client half first: samples accumulate and are flushed as a move packet
 * on a click or every fortieth sample, and a click packet carries its own
 * delta since the previous click. Then the engine half: records are appended
 * in order behind a time anchor once per 600 ms tick, and the chunk rotates at
 * 1500 bytes or 60 seconds.
 */
export function buildCapture(script: Script): InputChunkSource[] {
  const startedAt = script.startedAt ?? Date.parse("2026-09-05T12:00:00.000Z");
  const flushEvery = script.flushEvery ?? 40;
  const samples = [...(script.samples ?? [])].sort((a, b) => a.at - b.at);
  const clicks = [...(script.clicks ?? [])].sort((a, b) => a.at - b.at);
  const focus = [...(script.focus ?? [])].sort((a, b) => a.at - b.at);

  const packets: Packet[] = [];
  const state = newCursorState();
  let pending: ScriptSample[] = [];
  let previousClick: number | null = null;
  let clickIndex = 0;
  let focusIndex = 0;

  const flush = (at: number) => {
    if (pending.length === 0) return;
    const payload = encodeSamples(pending, state);
    pending = [];
    if (payload.length > 0) packets.push({ at, record: { kind: "move", payload } });
  };

  for (const sample of samples) {
    while (focusIndex < focus.length && focus[focusIndex].at <= sample.at) {
      const event = focus[focusIndex++];
      packets.push({ at: event.at, record: { kind: "focus", focus: event.focus } });
    }

    while (clickIndex < clicks.length && clicks[clickIndex].at <= sample.at) {
      const click = clicks[clickIndex++];
      flush(click.at);
      const delta =
        previousClick === null
          ? CLICK_DELTA_MAX
          : Math.floor((click.at - previousClick) / SAMPLE_MS);
      previousClick = click.at;
      packets.push({
        at: click.at,
        record: {
          kind: "click",
          word: encodeClickWord(delta, click.button ?? 0, click.x, click.y),
        },
      });
    }

    pending.push(sample);
    if (pending.length >= flushEvery) flush(sample.at);
  }

  const last = samples.length > 0 ? samples[samples.length - 1].at : 0;
  flush(last);

  while (clickIndex < clicks.length) {
    const click = clicks[clickIndex++];
    const delta =
      previousClick === null
        ? CLICK_DELTA_MAX
        : Math.floor((click.at - previousClick) / SAMPLE_MS);
    previousClick = click.at;
    packets.push({
      at: click.at,
      record: {
        kind: "click",
        word: encodeClickWord(delta, click.button ?? 0, click.x, click.y),
      },
    });
  }

  while (focusIndex < focus.length) {
    const event = focus[focusIndex++];
    packets.push({ at: event.at, record: { kind: "focus", focus: event.focus } });
  }

  packets.sort((a, b) => a.at - b.at);

  return frame(packets, startedAt, script.client ?? "web", script.reportAt);
}

/** The engine half: anchors, rotation, and the ring/live split. */
function frame(
  packets: readonly Packet[],
  startedAt: number,
  client: string,
  reportAt: number | undefined,
): InputChunkSource[] {
  const rows: InputChunkSource[] = [];
  let records: ChunkRecord[] = [];
  let chunkStart: number | null = null;
  let anchoredTick = -1;
  let bytes = 0;
  let seq = 0;
  let live = false;

  const seal = (at: number) => {
    if (chunkStart === null || records.length === 0) return;
    rows.push({
      seq: seq++,
      kind: live ? "live" : "ring",
      client,
      startedAt: new Date(startedAt + chunkStart).toISOString(),
      flushedAt: new Date(startedAt + at).toISOString(),
      data: base64(encodeChunk(records)),
    });
    records = [];
    chunkStart = null;
    anchoredTick = -1;
    bytes = 0;
  };

  for (const packet of packets) {
    const size =
      packet.record.kind === "move" ? 2 + packet.record.payload.length : 5;

    if (chunkStart !== null && (bytes + size > 1500 || packet.at - chunkStart >= 60_000)) {
      seal(packet.at);
    }

    if (reportAt !== undefined && !live && packet.at >= reportAt) {
      seal(packet.at);
      live = true;
      chunkStart = packet.at;
      anchoredTick = -1;
      records.push({ kind: "marker", reason: MARKER_LIVE_TAIL_BEGINS });
      bytes += 2;
    }

    if (chunkStart === null) chunkStart = packet.at;

    const tick = Math.floor((packet.at - chunkStart) / TICK_MS);
    if (tick !== anchoredTick) {
      anchoredTick = tick;
      records.push({ kind: "anchor", ticks: tick });
      bytes += 3;
    }

    records.push(packet.record);
    bytes += size;
  }

  const lastAt = packets.length > 0 ? packets[packets.length - 1].at : 0;
  seal(lastAt);
  return rows;
}

function base64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/**
 * The short form the throttling test wants: a path of samples, no clicks, and
 * a flush every few samples so there are records to compare.
 */
export function scriptChunks(
  path: readonly ScriptSample[],
  options: { flushEvery?: number; client?: string } = {},
): InputChunkSource[] {
  return buildCapture({
    samples: path,
    flushEvery: options.flushEvery ?? 5,
    client: options.client,
  });
}

/* --- the five streams the verdict is tested against --- */

/**
 * A small deterministic generator. `Math.random()` in a test that asserts a
 * verdict is a test that fails once a fortnight and passes on a re-run.
 */
export function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

/** Round to the client's sampling grid, so a script cannot cheat the clock. */
function grid(ms: number): number {
  return Math.round(ms / SAMPLE_MS) * SAMPLE_MS;
}

type Walk = { samples: ScriptSample[]; clicks: ScriptClick[] };

/**
 * Walk a mouse through a session: rest after each click, travel to the next
 * target, dwell on it, click.
 *
 * The cursor is sampled **every 50 ms whether it moved or not**, because that
 * is what the client does: a still cursor writes no step, it increments the
 * delta of the next one, and a generator that skipped those samples would
 * produce a stream no client could send and reconstruct times that no decoder
 * would ever see.
 *
 * `bend` is how far the path bows away from the straight line, as a fraction
 * of the distance; the travel is eased so the cursor decelerates into the
 * target, which is the thing a hand does and a `moveTo` does not.
 */
function walk(options: {
  clicks: number;
  target: (index: number) => { x: number; y: number };
  rest: (index: number) => number;
  dwell: (index: number) => number;
  steps: (index: number) => number;
  bend: number;
}): Walk {
  const samples: ScriptSample[] = [];
  const clicks: ScriptClick[] = [];
  let at = 0;
  let x = 380;
  let y = 250;

  for (let i = 0; i < options.clicks; i++) {
    const rest = grid(options.rest(i));
    for (let ms = 0; ms < rest; ms += SAMPLE_MS) {
      samples.push({ at, x, y });
      at += SAMPLE_MS;
    }

    const to = options.target(i);
    const steps = Math.max(1, options.steps(i));
    const fromX = x;
    const fromY = y;
    const midX = (fromX + to.x) / 2 - (to.y - fromY) * options.bend;
    const midY = (fromY + to.y) / 2 + (to.x - fromX) * options.bend;

    for (let k = 1; k <= steps; k++) {
      // Ease out: fast away from the last target, slow into the next one.
      const u = 1 - (1 - k / steps) ** 2;
      const inv = 1 - u;
      x = Math.round(inv * inv * fromX + 2 * inv * u * midX + u * u * to.x);
      y = Math.round(inv * inv * fromY + 2 * inv * u * midY + u * u * to.y);
      samples.push({ at, x, y });
      at += SAMPLE_MS;
    }

    x = to.x;
    y = to.y;

    const dwell = grid(options.dwell(i));
    for (let ms = 0; ms < dwell; ms += SAMPLE_MS) {
      samples.push({ at, x, y });
      at += SAMPLE_MS;
    }

    clicks.push({ at, x, y });
  }

  samples.push({ at, x, y });
  return { samples, clicks };
}

/** Somebody playing: uneven pauses, curved journeys, a hand that never sits still. */
export function humanStream(): InputChunkSource[] {
  const random = seeded(9051);
  const walked = walk({
    clicks: 70,
    target: (i) => {
      const base = i % 2 === 0 ? { x: 250, y: 180 } : { x: 520, y: 330 };
      return {
        x: base.x + Math.round(random() * 20) - 10,
        y: base.y + Math.round(random() * 20) - 10,
      };
    },
    rest: () => 200 + random() * 1300,
    dwell: () => 100 + random() * 800,
    steps: () => 10 + Math.floor(random() * 8),
    bend: 0.18,
  });
  return buildCapture(walked);
}

/** A script with a `sleep`: the same interval, the same pixel, no cursor at all. */
export function fixedPeriodStream(): InputChunkSource[] {
  const samples: ScriptSample[] = [];
  const clicks: ScriptClick[] = [];
  for (let at = 0; at <= 122_000; at += SAMPLE_MS) {
    samples.push({ at, x: 382, y: 251 });
  }
  for (let i = 1; i <= 60; i++) {
    clicks.push({ at: i * 2000, x: 382, y: 251 });
  }
  return buildCapture({ samples, clicks });
}

/**
 * A better script: it draws a curved path to each target, so the cursor looks
 * like a hand. Everything it does with a clock still does not.
 */
export function curvedPathStream(): InputChunkSource[] {
  const random = seeded(4477);
  const walked = walk({
    clicks: 70,
    target: () => ({
      x: 120 + Math.round(random() * 520),
      y: 100 + Math.round(random() * 300),
    }),
    rest: () => 500,
    dwell: () => 300,
    steps: () => 10,
    bend: 0.22,
  });
  return buildCapture(walked);
}

/** A phone: taps with no cursor between them, at a person's uneven pace. */
export function touchStream(): InputChunkSource[] {
  const random = seeded(2211);
  const walked = walk({
    clicks: 70,
    target: () => ({
      x: 120 + Math.round(random() * 520),
      y: 100 + Math.round(random() * 300),
    }),
    rest: () => 400 + random() * 1600,
    dwell: () => 0,
    // One sample: the pointer appears where the finger lands and nowhere else.
    steps: () => 1,
    bend: 0,
  });
  return buildCapture(walked);
}

/**
 * The same person, in a background tab. The browser throttles the 50 ms mouse
 * sampler to about one a second; the clicks are still theirs and still dated
 * by the world's own clock.
 */
export function throttledStream(): InputChunkSource[] {
  const random = seeded(9051);
  const walked = walk({
    clicks: 70,
    target: (i) => {
      const base = i % 2 === 0 ? { x: 250, y: 180 } : { x: 520, y: 330 };
      return {
        x: base.x + Math.round(random() * 20) - 10,
        y: base.y + Math.round(random() * 20) - 10,
      };
    },
    rest: () => 200 + random() * 1300,
    dwell: () => 100 + random() * 800,
    steps: () => 10 + Math.floor(random() * 8),
    bend: 0.18,
  });
  return buildCapture({
    samples: walked.samples.filter((_, index) => index % 20 === 0),
    clicks: walked.clicks,
  });
}
