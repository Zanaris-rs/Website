import { describe, expect, it } from "vitest";

import {
  OFFSCREEN_POS,
  SAMPLE_MS,
  base64ToBytes,
  decodeChunk,
  decodeMovePayload,
  decodeStream,
} from "./decode";
import contract from "./input-tracking-contract.json";
import {
  encodeChunk,
  encodeClickWord,
  encodeMovePayload,
  scriptChunks,
} from "./reference-encoder";

/**
 * The decoder, against three different kinds of authority.
 *
 * 1. **The cross-repo fixture.** `input-tracking-contract.json` is a byte-for-
 *    byte copy of `engine/test/fixtures/input-tracking-contract.json`: a real
 *    chunk the engine's own ring produced, with every event it must decode to
 *    written out. Nothing else in either repo pins this framing, so a change to
 *    `InputRing.ts` that this file does not know about has to fail here.
 * 2. **A reference encoder**, mirroring `Client.ts:2061-2189`. Round-tripping
 *    through it is what proves the boundaries: `delta = 7` is two bytes and
 *    `delta = 8` is three, `dx = 31` fits and `dx = 32` does not, and a decoder
 *    that got any of those backwards would still decode most streams correctly
 *    and mis-date the interesting ones.
 * 3. **Properties that must hold whatever the bytes are**: no throw, no
 *    infinite loop, and a position that is either inside the applet or the one
 *    off-applet value the client can send.
 */

describe("the cross-repo contract", () => {
  it("decodes the engine's own chunk into exactly the events it lists", () => {
    const chunk = contract.chunk;
    const decoded = decodeChunk(base64ToBytes(chunk.data), {
      durationMs: chunk.flushed_at - chunk.started_at,
    });

    expect(decoded.truncated).toBe(false);
    expect(decoded.events).toEqual(contract.events);
  });

  it("carries the same record and marker numbers the engine writes", () => {
    // Written out by hand: re-copying the fixture with a renumbered record
    // must fail here rather than decode a click as a camera angle.
    expect(contract.records).toEqual({
      camera_position: 1,
      applet_focus: 2,
      mouse_click: 3,
      mouse_move: 4,
      time_anchor: 5,
      marker: 6,
    });
    expect(contract.markers).toEqual({
      move_packet_dropped: 1,
      flood_cap: 2,
      ring_wrapped: 3,
      live_tail_begins: 4,
    });
    expect(contract.client).toEqual({
      tick_ms: 600,
      sample_ms: 50,
      screen_width: 765,
      screen_height: 503,
      offscreen_pos: 524287,
      click_delta_max: 4095,
      move_delta_max: 2047,
    });
    expect(contract.limits.move_payload_bytes).toBe(255);
  });

  it("raises the flags the fixture's markers stand for", () => {
    const decoded = decodeChunk(base64ToBytes(contract.chunk.data));
    // Marker 3 opens it, marker 1 and 2 are in the middle, and the first two
    // move steps are relative against a cursor nobody has seen yet.
    expect(decoded.flags).toContain("ring-wrapped");
    expect(decoded.flags).toContain("dropped-move");
    expect(decoded.flags).toContain("flooded");
    expect(decoded.flags).toContain("unknown-cursor");
  });
});

describe("the client's move encoding, round-tripped", () => {
  it("uses two bytes up to delta 7 and three from delta 8", () => {
    // The client's own branch: `mouseTrackDelta < 8` with both deltas inside
    // six bits is the short form, and everything else is absolute.
    expect(encodeMovePayload([{ delta: 7, dx: 1, dy: 1 }]).length).toBe(2);
    expect(
      encodeMovePayload([{ delta: 8, dx: 1, dy: 1, x: 100, y: 100 }]).length,
    ).toBe(4);
    expect(
      encodeMovePayload([{ delta: 0, dx: 40, dy: 0, x: 140, y: 100 }]).length,
    ).toBe(3);
  });

  it("round-trips every relative step at the edge of the six-bit field", () => {
    const start = { x: 400, y: 250, known: true };
    for (const dx of [-32, -31, -1, 0, 1, 30, 31]) {
      for (const dy of [-32, -31, 0, 31]) {
        const payload = encodeMovePayload([{ delta: 0, dx, dy }]);
        expect(payload.length).toBe(2);
        const { steps, cursor } = decodeMovePayload(payload, start);
        expect(steps).toHaveLength(1);
        expect(steps[0]).toEqual({
          delta: 0,
          x: start.x + dx,
          y: start.y + dy,
          absolute: false,
        });
        expect(cursor.known).toBe(true);
      }
    }
  });

  it("round-trips an absolute step at every corner of the applet", () => {
    for (const [x, y] of [
      [0, 0],
      [764, 0],
      [0, 502],
      [764, 502],
      [382, 251],
    ]) {
      for (const delta of [0, 7, 8, 2047]) {
        const payload = encodeMovePayload([{ delta, dx: 0, dy: 0, x, y }]);
        const { steps } = decodeMovePayload(payload, {
          x: 0,
          y: 0,
          known: false,
        });
        expect(steps[0]).toEqual({ delta, x, y, absolute: true });
      }
    }
  });

  it("decodes the off-applet position as (-1, -1) and not as a place", () => {
    const payload = encodeMovePayload([
      { delta: 0, dx: 0, dy: 0, x: -1, y: -1 },
    ]);
    const { steps } = decodeMovePayload(payload, { x: 0, y: 0, known: false });
    expect(steps[0].x).toBe(-1);
    expect(steps[0].y).toBe(-1);
    // 524287 is 0x7FFFF, which as a position would be y = 685, off the applet
    // in a way the client cannot send.
    expect(OFFSCREEN_POS).toBe(524287);
  });

  it("leaves a relative step against an unknown cursor without a position", () => {
    const payload = encodeMovePayload([
      { delta: 0, dx: 5, dy: 5 },
      { delta: 0, dx: 0, dy: 0, x: 200, y: 300 },
      { delta: 0, dx: 5, dy: 5 },
    ]);
    const { steps } = decodeMovePayload(payload, { x: 0, y: 0, known: false });
    expect(steps[0]).toEqual({ delta: 0, x: null, y: null, absolute: false });
    expect(steps[1]).toEqual({ delta: 0, x: 200, y: 300, absolute: true });
    expect(steps[2]).toEqual({ delta: 0, x: 205, y: 305, absolute: false });
  });

  it("resyncs rather than drawing a path off the applet", () => {
    // A relative step from a cursor we have wrong lands where no cursor can
    // be. The client clamps every sample into 765x503, so this is proof that
    // our state is wrong — not proof that the mouse left the screen.
    const payload = encodeMovePayload([{ delta: 0, dx: -32, dy: -32 }]);
    const { steps, cursor } = decodeMovePayload(payload, {
      x: 5,
      y: 5,
      known: true,
    });
    expect(steps[0].x).toBeNull();
    expect(cursor.known).toBe(false);
  });
});

describe("the click word", () => {
  it("round-trips button, position and the 50 ms delta", () => {
    for (const [x, y, button, delta] of [
      [0, 0, 0, 0],
      [764, 502, 1, 4095],
      [100, 50, 0, 20],
      [382, 251, 1, 1],
    ]) {
      const bytes = encodeChunk([
        { kind: "click", word: encodeClickWord(delta, button, x, y) },
      ]);
      const { events } = decodeChunk(bytes);
      const click = events.find((event) => event.type === "click");
      expect(click).toEqual({ type: "click", t: 0, delta, button, x, y });
    }
  });
});

describe("times", () => {
  it("dates an anchored record at the tick the anchor names", () => {
    const bytes = encodeChunk([
      { kind: "anchor", ticks: 0 },
      { kind: "focus", focus: 1 },
      { kind: "anchor", ticks: 3 },
      { kind: "camera", pitch: 128, yaw: 1024 },
    ]);
    const { events } = decodeChunk(bytes);
    expect(events.map((event) => event.t)).toEqual([0, 0, 1800, 1800]);
  });

  it("runs a move record's samples backwards from its arrival", () => {
    // Three steps, the middle one after eight still samples: five samples in
    // all, ending at the anchor. A decoder that ran them forwards would put a
    // click 500 ms after a move that in fact preceded it.
    const bytes = encodeChunk([
      { kind: "anchor", ticks: 10 },
      { kind: "move",
        payload: encodeMovePayload([
          { delta: 0, dx: 0, dy: 0, x: 100, y: 100 },
          { delta: 2, dx: 1, dy: 1 },
          { delta: 0, dx: 1, dy: 1 },
        ]),
      },
    ]);
    const { events } = decodeChunk(bytes);
    const moves = events.filter((event) => event.type === "move");
    expect(moves.map((event) => event.t)).toEqual([
      6000 - 4 * SAMPLE_MS,
      6000 - SAMPLE_MS,
      6000,
    ]);
  });

  it("falls back to the click chain when a chunk carries no anchor", () => {
    // Nothing the current engine writes, but a decoder that assumed anchors
    // would throw away the whole capture. The clicks are 1 s apart by their
    // own deltas and the last record is pinned to flushed_at.
    const bytes = encodeChunk([
      { kind: "click", word: encodeClickWord(20, 0, 100, 100) },
      { kind: "click", word: encodeClickWord(20, 0, 110, 110) },
      { kind: "click", word: encodeClickWord(20, 0, 120, 120) },
    ]);
    const { events } = decodeChunk(bytes, { durationMs: 2000 });
    expect(events.map((event) => event.t)).toEqual([0, 1000, 2000]);
  });
});

describe("decodeStream", () => {
  it("threads the cursor from one chunk into the next", () => {
    // The client's cursor state is session-global and never re-sent, so the
    // relative step opening chunk 1 is only decodable against where chunk 0
    // left the mouse.
    const first = encodeChunk([
      { kind: "anchor", ticks: 0 },
      { kind: "move",
        payload: encodeMovePayload([{ delta: 0, dx: 0, dy: 0, x: 300, y: 200 }]),
      },
    ]);
    const second = encodeChunk([
      { kind: "anchor", ticks: 0 },
      { kind: "move",
        payload: encodeMovePayload([{ delta: 0, dx: 10, dy: 10 }]),
      },
    ]);

    const stream = decodeStream([
      {
        seq: 0,
        kind: "ring",
        client: "web",
        startedAt: "2026-09-05T12:00:00.000Z",
        flushedAt: "2026-09-05T12:00:01.000Z",
        data: Buffer.from(first).toString("base64"),
      },
      {
        seq: 1,
        kind: "live",
        client: "web",
        startedAt: "2026-09-05T12:00:01.000Z",
        flushedAt: "2026-09-05T12:00:02.000Z",
        data: Buffer.from(second).toString("base64"),
      },
    ]);

    const moves = stream.events.filter((event) => event.type === "move");
    expect(moves[1].x).toBe(310);
    expect(moves[1].y).toBe(210);
    expect(stream.ringChunks).toBe(1);
    expect(stream.liveChunks).toBe(1);
    expect(stream.liveFrom).toBe(Date.parse("2026-09-05T12:00:01.000Z"));
  });

  it("orders by seq, whatever order the rows arrive in", () => {
    const rows = [1, 0, 2].map((seq) => ({
      seq,
      kind: "ring",
      client: "web",
      startedAt: `2026-09-05T12:00:0${seq}.000Z`,
      flushedAt: `2026-09-05T12:00:0${seq + 1}.000Z`,
      data: Buffer.from(
        encodeChunk([
          { kind: "anchor", ticks: 0 },
          { kind: "click", word: encodeClickWord(20, 0, seq, 0) },
        ]),
      ).toString("base64"),
    }));
    const stream = decodeStream(rows);
    const clicks = stream.events.filter((event) => event.type === "click");
    expect(clicks.map((click) => click.x)).toEqual([0, 1, 2]);
  });

  it("flags a Java client, whose stream has no usable cursor path", () => {
    const stream = decodeStream([
      {
        seq: 0,
        kind: "ring",
        client: "java",
        startedAt: "2026-09-05T12:00:00.000Z",
        flushedAt: "2026-09-05T12:00:01.000Z",
        data: "",
      },
    ]);
    expect(stream.flags).toContain("java-client");
    expect(stream.clients).toEqual(["java"]);
  });

  it("flags a throttled tab: samples that account for a fraction of the clock", () => {
    // A background tab's 50 ms sampler runs at about 1 Hz while the engine's
    // anchors keep 600 ms time, so each record covers far less than the gap
    // before it.
    const stream = decodeStream(
      scriptChunks(
        Array.from({ length: 40 }, (_, i) => ({
          at: i * 1000,
          x: 100 + i,
          y: 100 + i,
        })),
        { flushEvery: 5 },
      ),
    );
    expect(stream.flags).toContain("throttled");
  });

  it("drops a chunk with no started_at rather than dating it from nothing", () => {
    const stream = decodeStream([
      {
        seq: 0,
        kind: "ring",
        client: "web",
        startedAt: null,
        flushedAt: null,
        data: "BgM=",
      },
    ]);
    expect(stream.events).toHaveLength(0);
    expect(stream.chunks).toBe(0);
  });
});

describe("bytes nobody meant to send", () => {
  it("stops at a truncated record and says so", () => {
    // A move record whose length runs past the end of the data.
    const bytes = new Uint8Array([4, 40, 1, 2, 3]);
    const decoded = decodeChunk(bytes);
    expect(decoded.truncated).toBe(true);
    expect(decoded.flags).toContain("truncated");
  });

  it("stops at a record type it does not know", () => {
    const decoded = decodeChunk(new Uint8Array([9, 9, 9]));
    expect(decoded.truncated).toBe(true);
    expect(decoded.events).toHaveLength(0);
  });

  it("never throws and never runs long, on random bytes", () => {
    let seed = 20260905;
    const random = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    for (let run = 0; run < 200; run++) {
      const bytes = new Uint8Array(64);
      for (let i = 0; i < bytes.length; i++) bytes[i] = (random() * 256) | 0;
      const decoded = decodeChunk(bytes);
      for (const event of decoded.events) {
        if (event.type !== "move" && event.type !== "click") continue;
        if (event.x === null || event.y === null) continue;

        // An absolute position is whatever the 19 bits say, and random bytes
        // can say 685 rows down a 503-row applet — the decoder reports the
        // stream rather than tidying it. What must always hold is that it is a
        // number in the range those bits can describe, so nothing downstream
        // divides by a NaN or draws at minus infinity.
        expect(Number.isInteger(event.x)).toBe(true);
        expect(Number.isInteger(event.y)).toBe(true);
        expect(event.x).toBeGreaterThanOrEqual(-1);
        expect(event.x).toBeLessThan(765);
        expect(event.y).toBeGreaterThanOrEqual(-1);
        expect(event.y).toBeLessThanOrEqual(685);

        // A *relative* step is different: it is computed against a cursor we
        // are tracking, so one that leaves the applet is proof the tracking is
        // wrong, and the decoder drops the position instead of inventing one.
        if (event.type === "move" && event.delta >= 0 && event.x !== -1) {
          expect(event.y).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  it("cannot be written in the first place: the encoder refuses a long payload", () => {
    // The length is a `p1`, and the ring drops anything longer with marker 1.
    // An encoder that masked it would write a length the decoder believes and
    // a payload it cannot find the end of.
    expect(() =>
      encodeChunk([{ kind: "move", payload: new Uint8Array(256) }]),
    ).toThrow(/at most 255 bytes/);
    expect(() =>
      encodeChunk([{ kind: "move", payload: new Uint8Array(255) }]),
    ).not.toThrow();
  });

  it("reads an empty chunk as an empty stream", () => {
    expect(decodeChunk(new Uint8Array(0)).events).toEqual([]);
    expect(base64ToBytes("")).toEqual(new Uint8Array(0));
  });
});
