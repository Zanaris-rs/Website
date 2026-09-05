import contract from "./input-tracking-contract.json";

/**
 * The only thing anywhere that reads `report_input.data`.
 *
 * The world records a player's mouse into a ring in memory and drains it when
 * somebody reports them, in a framing of its own (`InputRing.ts`) wrapped
 * around the client's own encoding (`Client.ts:2061-2189`). Neither side
 * decodes it: the engine passes the client's bytes through untouched and the
 * database stores them as `bytea`. This file turns them back into events, and
 * `input-tracking-contract.json` — copied byte for byte out of the engine's
 * test fixtures — is what stops the two repos drifting apart in silence.
 *
 * ## Two encodings, one after the other
 *
 * The outer one is the engine's: a one-byte record type then a big-endian
 * payload.
 *
 * | Type | Record | Payload |
 * | --- | --- | --- |
 * | 1 | camera position | `p2` pitch, `p2` yaw |
 * | 2 | applet focus | `p1` focus (1 gained, 0 lost) |
 * | 3 | mouse click | `p4` the client's click word |
 * | 4 | mouse move | `p1` length, then that many bytes of the client's own |
 * | 5 | time anchor | `p2` ticks since the chunk began |
 * | 6 | marker | `p1` reason |
 *
 * The inner one is the client's, and it exists because the 2004 protocol has
 * no room for timestamps. A click is one 32-bit word,
 * `(delta50ms << 20) | (button << 19) | (y * 765 + x)`, where `delta` is how
 * many 50 ms samples passed since the *previous click* — the only real clock
 * in the whole stream. A move packet is a run of steps in one of three
 * encodings, chosen by the top bits of the first byte:
 *
 * - `0b0…` two bytes: `(delta << 12) | (dx + 32) << 6 | (dy + 32)`, a relative
 *   step, only when `delta < 8` and both deltas fit in six bits;
 * - `0b10…` three bytes: `0x800000 | (delta << 19) | pos`, absolute, `delta < 8`;
 * - `0b11…` four bytes: `0xC0000000 | (delta << 19) | pos`, absolute, `delta`
 *   up to 2047.
 *
 * `pos` is `y * 765 + x`, and `0x7FFFF` means the cursor left the applet, which
 * decodes as `(-1, -1)`. A step's `delta` counts the samples in which the
 * cursor did **not** move; the step itself is the sample in which it did.
 *
 * ## Where the times come from
 *
 * Everything is milliseconds from the chunk's `started_at`.
 *
 * The engine writes a time anchor at most once per tick, ahead of the first
 * record that tick appends, so a camera, focus, click or marker record is
 * dated by the anchor in force — 600 ms resolution, which is all the engine
 * knows. A move record's samples *end* at that instant and run backwards at
 * 50 ms each, so sample `k` of the `N` a record accounts for sits at
 * `T - (N - 1 - k) * 50`. That is why the events of one move record can be
 * dated earlier than the record before it: they are, and sorting them by time
 * would be the lie.
 *
 * When a chunk carries no anchor at all — nothing the current engine writes,
 * but a decoder that assumed otherwise would throw away a whole capture — the
 * click chain becomes the master clock: the clicks' own deltas give the
 * spacing and the last record is pinned to `flushed_at`, so the reconstruction
 * runs backwards from the one time the database is sure of.
 *
 * ## What can go wrong, and what it is called
 *
 * The cursor is a *relative* encoding whose state lives in the client across
 * packets and is never re-sent, so a capture that begins mid-session has no
 * idea where the mouse is until the first absolute step: those steps decode
 * with `x` and `y` null and raise `unknown-cursor`. The same happens after a
 * dropped move packet (marker 1) and after a relative step that lands
 * somewhere no cursor can be — the client clamps to the 765x503 applet, so an
 * off-map result means the decoder's idea of the cursor is wrong and it says
 * so instead of drawing a line to a place nobody clicked.
 */

/* --- the contract, read rather than repeated --- */

const RECORD = contract.records;
const MARKER = contract.markers;

/** 600 ms, the game's tick: the resolution of every anchored event. */
export const TICK_MS = contract.client.tick_ms;
/** 50 ms, the client's mouse sampler. The resolution of everything else. */
export const SAMPLE_MS = contract.client.sample_ms;
export const SCREEN_WIDTH = contract.client.screen_width;
export const SCREEN_HEIGHT = contract.client.screen_height;
/** `pos` when the cursor is outside the applet. */
export const OFFSCREEN_POS = contract.client.offscreen_pos;
/** The longest move payload the engine's one-byte length field can frame. */
export const MOVE_PAYLOAD_LIMIT = contract.limits.move_payload_bytes;
/** A click delta saturates here: "at least this long since the last click". */
export const CLICK_DELTA_MAX = contract.client.click_delta_max;
export const MOVE_DELTA_MAX = contract.client.move_delta_max;

export const MARKER_MOVE_PACKET_DROPPED = MARKER.move_packet_dropped;
export const MARKER_FLOOD_CAP = MARKER.flood_cap;
export const MARKER_RING_WRAPPED = MARKER.ring_wrapped;
export const MARKER_LIVE_TAIL_BEGINS = MARKER.live_tail_begins;

/* --- events --- */

export type MarkerEvent = { type: "marker"; t: number; reason: number };
export type AnchorEvent = { type: "anchor"; t: number; ticks: number };
export type FocusEvent = { type: "focus"; t: number; focus: number };
export type CameraEvent = {
  type: "camera";
  t: number;
  pitch: number;
  yaw: number;
};
export type ClickEvent = {
  type: "click";
  t: number;
  /** 50 ms samples since the previous click, saturating at 4095. */
  delta: number;
  /** 0 left, 1 right. */
  button: number;
  x: number;
  y: number;
};
export type MoveEvent = {
  type: "move";
  t: number;
  /** Samples in which the cursor did not move before this one. */
  delta: number;
  /** Null while the cursor's position is unknown. */
  x: number | null;
  y: number | null;
};

export type InputEvent =
  | MarkerEvent
  | AnchorEvent
  | FocusEvent
  | CameraEvent
  | ClickEvent
  | MoveEvent;

/**
 * What a decode could not do properly.
 *
 * These are not verdicts and they are not errors. Every one of them changes
 * what a metric is allowed to claim: a stream with `java-client` has no usable
 * cursor path, a `throttled` one has a mouse sampler running slower than the
 * clock it is dated by, and `unknown-cursor` means some of the positions on
 * the page are missing rather than wrong.
 */
export type DecodeFlag =
  | "unknown-cursor"
  | "throttled"
  | "java-client"
  | "flooded"
  | "dropped-move"
  | "ring-wrapped"
  | "truncated";

export type Cursor = {
  readonly x: number;
  readonly y: number;
  /** False until an absolute step has been seen. */
  readonly known: boolean;
};

const UNKNOWN_CURSOR: Cursor = { x: 0, y: 0, known: false };

/** Where one move record ended, and how many 50 ms samples it accounted for. */
export type MoveRecordSpan = { readonly t: number; readonly samples: number };

export type DecodedChunk = {
  readonly events: readonly InputEvent[];
  /** The cursor as it stood at the end, to carry into the next chunk. */
  readonly cursor: Cursor;
  readonly flags: readonly DecodeFlag[];
  /** True when a record ran off the end of the data. */
  readonly truncated: boolean;
  /** One entry per move record, for the throttling check. */
  readonly moveRecords: readonly MoveRecordSpan[];
};

/* --- base64 --- */

/**
 * `bytea` reaches the site as base64 because a hex-escaped `bytea` over the
 * wire is a different argument in every driver.
 *
 * `atob` is the platform's, present in Node 18+, in the Next server runtime
 * and in every browser, and it is the only environment call in this file — the
 * rest is arithmetic, which is what makes the decoder testable without a
 * database.
 */
export function base64ToBytes(data: string): Uint8Array {
  if (data === "") return new Uint8Array(0);
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/* --- the client's move encoding --- */

export type MoveStep = {
  /** Samples skipped before this one. */
  readonly delta: number;
  readonly x: number | null;
  readonly y: number | null;
  /** True when the step said where the cursor is rather than how far it went. */
  readonly absolute: boolean;
};

function unpackPos(pos: number): { x: number; y: number } {
  if (pos === OFFSCREEN_POS) return { x: -1, y: -1 };
  return { x: pos % SCREEN_WIDTH, y: Math.floor(pos / SCREEN_WIDTH) };
}

/** Inside the applet, or exactly the one off-applet position the client sends. */
function plausible(x: number, y: number): boolean {
  if (x === -1 && y === -1) return true;
  return x >= 0 && x < SCREEN_WIDTH && y >= 0 && y < SCREEN_HEIGHT;
}

/**
 * One move payload, as the client framed it, against a running cursor.
 *
 * The steps come back in order with the cursor state they left behind. A
 * relative step against an unknown cursor is still a step — it happened, and
 * it is worth a mark on the timeline — it just has no position.
 */
export function decodeMovePayload(
  payload: Uint8Array,
  start: Cursor,
): { steps: MoveStep[]; cursor: Cursor } {
  const steps: MoveStep[] = [];
  let cursor = start;
  let pos = 0;

  while (pos < payload.length) {
    const head = payload[pos];

    if ((head & 0x80) === 0) {
      // Two bytes, relative.
      if (pos + 2 > payload.length) break;
      const word = (payload[pos] << 8) | payload[pos + 1];
      pos += 2;

      const delta = (word >> 12) & 0x7;
      const dx = ((word >> 6) & 0x3f) - 32;
      const dy = (word & 0x3f) - 32;

      if (!cursor.known) {
        steps.push({ delta, x: null, y: null, absolute: false });
        continue;
      }

      const x = cursor.x + dx;
      const y = cursor.y + dy;

      // The client clamps every sample into the applet, so a relative step
      // that lands outside it cannot have come from a cursor we are tracking
      // correctly. Rather than draw a path through a place the mouse has never
      // been, the cursor goes unknown until the next absolute step re-seats it.
      if (!plausible(x, y)) {
        cursor = UNKNOWN_CURSOR;
        steps.push({ delta, x: null, y: null, absolute: false });
        continue;
      }

      cursor = { x, y, known: true };
      steps.push({ delta, x, y, absolute: false });
      continue;
    }

    if ((head & 0xc0) === 0x80) {
      // Three bytes, absolute.
      if (pos + 3 > payload.length) break;
      const word =
        (payload[pos] << 16) | (payload[pos + 1] << 8) | payload[pos + 2];
      pos += 3;

      const delta = (word >> 19) & 0x7;
      const { x, y } = unpackPos(word & 0x7ffff);
      cursor = { x, y, known: true };
      steps.push({ delta, x, y, absolute: true });
      continue;
    }

    // Four bytes, absolute, with a delta of up to 2047.
    if (pos + 4 > payload.length) break;
    const word =
      ((payload[pos] << 24) |
        (payload[pos + 1] << 16) |
        (payload[pos + 2] << 8) |
        payload[pos + 3]) >>>
      0;
    pos += 4;

    const delta = (word >>> 19) & 0x7ff;
    const { x, y } = unpackPos(word & 0x7ffff);
    cursor = { x, y, known: true };
    steps.push({ delta, x, y, absolute: true });
  }

  return { steps, cursor };
}

/* --- the engine's framing --- */

/** One record, before it is given a time. */
type RawRecord =
  | { kind: "camera"; pitch: number; yaw: number }
  | { kind: "focus"; focus: number }
  | { kind: "click"; word: number }
  | { kind: "move"; payload: Uint8Array }
  | { kind: "anchor"; ticks: number }
  | { kind: "marker"; reason: number };

function readRecords(bytes: Uint8Array): {
  records: RawRecord[];
  truncated: boolean;
} {
  const records: RawRecord[] = [];
  let pos = 0;

  while (pos < bytes.length) {
    const type = bytes[pos];

    if (type === RECORD.camera_position) {
      if (pos + 5 > bytes.length) return { records, truncated: true };
      records.push({
        kind: "camera",
        pitch: (bytes[pos + 1] << 8) | bytes[pos + 2],
        yaw: (bytes[pos + 3] << 8) | bytes[pos + 4],
      });
      pos += 5;
    } else if (type === RECORD.applet_focus) {
      if (pos + 2 > bytes.length) return { records, truncated: true };
      records.push({ kind: "focus", focus: bytes[pos + 1] });
      pos += 2;
    } else if (type === RECORD.mouse_click) {
      if (pos + 5 > bytes.length) return { records, truncated: true };
      records.push({
        kind: "click",
        word:
          ((bytes[pos + 1] << 24) |
            (bytes[pos + 2] << 16) |
            (bytes[pos + 3] << 8) |
            bytes[pos + 4]) >>>
          0,
      });
      pos += 5;
    } else if (type === RECORD.mouse_move) {
      if (pos + 2 > bytes.length) return { records, truncated: true };
      const length = bytes[pos + 1];
      if (pos + 2 + length > bytes.length) return { records, truncated: true };
      records.push({
        kind: "move",
        payload: bytes.subarray(pos + 2, pos + 2 + length),
      });
      pos += 2 + length;
    } else if (type === RECORD.time_anchor) {
      if (pos + 3 > bytes.length) return { records, truncated: true };
      records.push({ kind: "anchor", ticks: (bytes[pos + 1] << 8) | bytes[pos + 2] });
      pos += 3;
    } else if (type === RECORD.marker) {
      if (pos + 2 > bytes.length) return { records, truncated: true };
      records.push({ kind: "marker", reason: bytes[pos + 1] });
      pos += 2;
    } else {
      // A record type this build does not know. There is no length in front of
      // it to skip, so the rest of the chunk is unreadable and saying so is the
      // only honest thing left.
      return { records, truncated: true };
    }
  }

  return { records, truncated: false };
}

/** How many 50 ms samples a move record accounts for. */
function sampleCount(steps: readonly MoveStep[]): number {
  let total = 0;
  for (const step of steps) total += step.delta + 1;
  return total;
}

/**
 * One chunk, decoded against the cursor the chunk before it left behind.
 *
 * `flushedAt - startedAt` is only used when the chunk has no anchor in it, and
 * may be passed as null when it is not known.
 */
export function decodeChunk(
  bytes: Uint8Array,
  options: { cursor?: Cursor; durationMs?: number | null } = {},
): DecodedChunk {
  const { records, truncated } = readRecords(bytes);
  const flags = new Set<DecodeFlag>();
  if (truncated) flags.add("truncated");

  let cursor = options.cursor ?? UNKNOWN_CURSOR;

  // Pass one: decode every record's payload and work out what each is worth in
  // samples, without dating anything.
  type Timed = { record: RawRecord; steps?: MoveStep[]; clock: number };
  const timed: Timed[] = [];

  const anchored = records.some((record) => record.kind === "anchor");
  let clock = 0;
  /** Only used when there is no anchor: where the last click was put. */
  let previousClick: number | null = null;

  for (const record of records) {
    if (record.kind === "anchor") {
      clock = record.ticks * TICK_MS;
      timed.push({ record, clock });
      continue;
    }

    if (record.kind === "move") {
      const decoded = decodeMovePayload(record.payload, cursor);
      cursor = decoded.cursor;
      for (const step of decoded.steps) {
        if (step.x === null) flags.add("unknown-cursor");
      }
      // Without an anchor the samples themselves carry the clock forward: a
      // record's samples end at its arrival, so the arrival is that much later
      // than the record before it.
      if (!anchored) clock += sampleCount(decoded.steps) * SAMPLE_MS;
      timed.push({ record, steps: decoded.steps, clock });
      continue;
    }

    if (record.kind === "click" && !anchored) {
      // The click's own delta is the time since the previous click, and it is
      // the only spacing in the stream that does not come from the engine.
      // `max` rather than `+`: the samples between two clicks and the click
      // delta measure the same interval, so taking both would count it twice.
      const delta = (record.word >>> 20) & 0xfff;
      if (previousClick !== null && delta < CLICK_DELTA_MAX) {
        clock = Math.max(clock, previousClick + delta * SAMPLE_MS);
      }
      previousClick = clock;
    }

    if (record.kind === "marker") {
      if (record.reason === MARKER_MOVE_PACKET_DROPPED) {
        flags.add("dropped-move");
        // Steps we never saw moved the cursor somewhere we cannot compute.
        cursor = UNKNOWN_CURSOR;
      }
      if (record.reason === MARKER_FLOOD_CAP) flags.add("flooded");
      if (record.reason === MARKER_RING_WRAPPED) flags.add("ring-wrapped");
    }

    timed.push({ record, clock });
  }

  // Pass two: with no anchor, the whole chunk slides so its last record lands
  // on `flushed_at` — reconstruction backwards from the one time the database
  // is sure of.
  let shift = 0;
  if (!anchored && timed.length > 0) {
    const duration = options.durationMs;
    if (typeof duration === "number" && Number.isFinite(duration)) {
      shift = duration - timed[timed.length - 1].clock;
    }
  }

  const events: InputEvent[] = [];
  const moveRecords: MoveRecordSpan[] = [];

  for (const entry of timed) {
    const t = entry.clock + shift;
    const record = entry.record;

    switch (record.kind) {
      case "anchor":
        events.push({ type: "anchor", t, ticks: record.ticks });
        break;
      case "marker":
        events.push({ type: "marker", t, reason: record.reason });
        break;
      case "focus":
        events.push({ type: "focus", t, focus: record.focus });
        break;
      case "camera":
        events.push({ type: "camera", t, pitch: record.pitch, yaw: record.yaw });
        break;
      case "click": {
        const word = record.word;
        const { x, y } = unpackPos(word & 0x7ffff);
        events.push({
          type: "click",
          t,
          delta: (word >>> 20) & 0xfff,
          button: (word >>> 19) & 0x1,
          x,
          y,
        });
        break;
      }
      case "move": {
        const steps = entry.steps ?? [];
        const total = sampleCount(steps);
        if (total > 0) moveRecords.push({ t, samples: total });
        let index = 0;
        for (const step of steps) {
          index += step.delta;
          events.push({
            type: "move",
            t: t - (total - 1 - index) * SAMPLE_MS,
            delta: step.delta,
            x: step.x,
            y: step.y,
          });
          index += 1;
        }
        break;
      }
    }
  }

  return { events, cursor, flags: [...flags], truncated, moveRecords };
}

/* --- a whole capture --- */

/**
 * A chunk as `accounts.staff_report_input` returns it. Structural on purpose:
 * `lib/staff/queries.ts` produces exactly this shape and this file does not
 * import it, so the decoder stays a pure function of bytes and two dates.
 */
export type InputChunkSource = {
  readonly seq: number;
  readonly kind: string;
  readonly client: string;
  readonly startedAt: string | null;
  readonly flushedAt: string | null;
  /** base64 */
  readonly data: string;
};

/** An event with the wall-clock time it happened and where it came from. */
export type StreamEvent = InputEvent & {
  /** Epoch milliseconds. */
  readonly at: number;
  readonly seq: number;
  /** True for a chunk captured after the report rather than out of the ring. */
  readonly live: boolean;
};

export type InputStream = {
  readonly events: readonly StreamEvent[];
  readonly flags: readonly DecodeFlag[];
  readonly chunks: number;
  readonly ringChunks: number;
  readonly liveChunks: number;
  /** `web`, `java`, or both when a player changed client mid-capture. */
  readonly clients: readonly string[];
  /** Epoch ms of the first and last event, or null when there are none. */
  readonly from: number | null;
  readonly to: number | null;
  /** Where the live tail begins, from marker 4 or the first live chunk. */
  readonly liveFrom: number | null;
};

function millis(iso: string | null): number | null {
  if (iso === null) return null;
  const at = new Date(iso).getTime();
  return Number.isNaN(at) ? null : at;
}

/**
 * The whole capture, oldest chunk first.
 *
 * The cursor is threaded from one chunk into the next, which is the only way
 * a relative step in chunk 3 can be given a position at all: the client's
 * cursor state is session-global and never re-sent. A chunk with no
 * `started_at` is dropped rather than dated from nothing.
 */
export function decodeStream(
  rows: readonly InputChunkSource[],
): InputStream {
  const ordered = [...rows].sort((a, b) => a.seq - b.seq);
  const events: StreamEvent[] = [];
  const flags = new Set<DecodeFlag>();
  const clients = new Set<string>();

  let cursor = UNKNOWN_CURSOR;
  let ringChunks = 0;
  let liveChunks = 0;
  let liveFrom: number | null = null;
  let used = 0;
  const spans: MoveRecordSpan[] = [];

  for (const row of ordered) {
    const startedAt = millis(row.startedAt);
    if (startedAt === null) continue;
    const flushedAt = millis(row.flushedAt);

    if (row.client !== "") clients.add(row.client);
    if (row.client === "java") flags.add("java-client");

    const live = row.kind === "live";
    if (live) liveChunks += 1;
    else ringChunks += 1;
    used += 1;

    const decoded = decodeChunk(base64ToBytes(row.data), {
      cursor,
      durationMs: flushedAt === null ? null : flushedAt - startedAt,
    });
    cursor = decoded.cursor;
    for (const flag of decoded.flags) flags.add(flag);
    for (const span of decoded.moveRecords) {
      spans.push({ t: startedAt + span.t, samples: span.samples });
    }

    for (const event of decoded.events) {
      const at = startedAt + event.t;
      events.push({ ...event, at, seq: row.seq, live });
      if (
        liveFrom === null &&
        ((event.type === "marker" && event.reason === MARKER_LIVE_TAIL_BEGINS) ||
          live)
      ) {
        liveFrom = at;
      }
    }
  }

  if (isThrottled(spans)) flags.add("throttled");

  let from: number | null = null;
  let to: number | null = null;
  for (const event of events) {
    if (from === null || event.at < from) from = event.at;
    if (to === null || event.at > to) to = event.at;
  }

  return {
    events,
    flags: [...flags],
    chunks: used,
    ringChunks,
    liveChunks,
    clients: [...clients],
    from,
    to,
    liveFrom,
  };
}

/**
 * Is the client's mouse sampler running slower than the clock dating it?
 *
 * The sampler is a 50 ms timer in the page, and a browser throttles the timers
 * of a background tab to about one a second. The engine's anchors keep running
 * at 600 ms whatever the tab is doing, so a throttled capture shows move
 * records whose samples account for far less time than passed between them —
 * which reads, to every timing signal, like a player whose mouse moves in
 * perfectly spaced bursts.
 *
 * The comparison is per move record: samples accounted for against the wall
 * clock since the previous one. Five records and a median ratio past two is
 * the call; below that it is an ordinary player who stopped touching the mouse.
 */
export function isThrottled(spans: readonly MoveRecordSpan[]): boolean {
  const ratios: number[] = [];

  for (let i = 1; i < spans.length; i++) {
    const wall = spans[i].t - spans[i - 1].t;
    const covered = spans[i].samples * SAMPLE_MS;
    if (wall > 0 && covered > 0) ratios.push(wall / covered);
  }

  if (ratios.length < 5) return false;
  const sorted = [...ratios].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  return median > 2;
}
