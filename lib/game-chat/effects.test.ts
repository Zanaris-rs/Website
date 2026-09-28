import { describe, expect, it } from "vitest";

import {
  CHAT_COLOUR_NAMES,
  colourAt,
  cssColour,
  scrollOffset,
  scrollPass,
  waveOffset,
  waveRuns,
} from "./effects";

describe("colourAt (Client.ts, the overhead chat)", () => {
  it("draws the six fixed colours as the client's CHAT_COLOURS", () => {
    expect([0, 1, 2, 3, 4, 5].map((c) => colourAt(c, 0))).toEqual([
      0xffff00, 0xff0000, 0x00ff00, 0x00ffff, 0xff00ff, 0xffffff,
    ]);
  });
  it("flashes on sceneCycle % 20 < 10", () => {
    expect(colourAt(6, 9)).toBe(0xff0000);
    expect(colourAt(6, 10)).toBe(0xffff00);
    expect(colourAt(7, 0)).toBe(0x0000ff);
    expect(colourAt(7, 15)).toBe(0x00ffff);
    expect(colourAt(8, 0)).toBe(0x00b000);
    expect(colourAt(8, 19)).toBe(0x80ff80);
  });
  it("glows over a 150-cycle line life, looped", () => {
    expect(colourAt(9, 0)).toBe(0xff0000);
    expect(colourAt(9, 49)).toBe(49 * 1280 + 0xff0000);
    expect(colourAt(9, 50)).toBe(0xffff00);
    expect(colourAt(9, 100)).toBe(0x00ff00);
    expect(colourAt(9, 150)).toBe(colourAt(9, 0));
    expect(colourAt(10, 60)).toBe(0xff00ff - 10 * 327680);
    expect(colourAt(11, 0)).toBe(0xffffff);
    expect(colourAt(11, 120)).toBe(0xffffff - 20 * 327680);
  });
  it("names every colour", () => {
    expect(CHAT_COLOUR_NAMES).toHaveLength(12);
  });
});

describe("waveOffset (PixFont.centreStringWave)", () => {
  it("is (sin(i / 2 + cycle / 5) * 5) truncated", () => {
    expect(waveOffset(0, 0)).toBe(0);
    expect(waveOffset(3, 0)).toBe(4);
    expect(waveOffset(0, 5)).toBe(4);
    expect(waveOffset(0, 16)).toBe(Math.trunc(Math.sin(16 / 5) * 5));
  });
});

describe("waveRuns (a wave line, split so it wraps between words)", () => {
  it("is nothing for no text", () => {
    expect(waveRuns("")).toEqual([]);
  });
  it("keeps a word's characters, each at its index in the line", () => {
    expect(waveRuns("hi")).toEqual([{ kind: "word", chars: [{ ch: "h", i: 0 }, { ch: "i", i: 1 }] }]);
  });
  it("leaves spaces as plain text between words, and counts them, as the client does", () => {
    expect(waveRuns("a bc")).toEqual([
      { kind: "word", chars: [{ ch: "a", i: 0 }] },
      { kind: "space", text: " " },
      { kind: "word", chars: [{ ch: "b", i: 2 }, { ch: "c", i: 3 }] },
    ]);
  });
  it("keeps runs of spaces whole, leading and trailing ones too", () => {
    expect(waveRuns("  ab  c ")).toEqual([
      { kind: "space", text: "  " },
      { kind: "word", chars: [{ ch: "a", i: 2 }, { ch: "b", i: 3 }] },
      { kind: "space", text: "  " },
      { kind: "word", chars: [{ ch: "c", i: 6 }] },
      { kind: "space", text: " " },
    ]);
  });
  it("gives every character of an 80-character line the index waveOffset gets in the client", () => {
    const line = "Selling lobbies ".repeat(5);
    const all = [...line];
    const runs = waveRuns(line);
    const joined = runs.map((run) => (run.kind === "space" ? run.text : run.chars.map((c) => c.ch).join(""))).join("");
    expect(joined).toBe(line);
    const indexed = runs.flatMap((run) => (run.kind === "word" ? run.chars : []));
    expect(indexed.map((c) => c.i)).toEqual(all.flatMap((ch, i) => (ch === " " ? [] : [i])));
    for (const { ch, i } of indexed) expect(all[i]).toBe(ch);
  });
});

describe("scrollOffset", () => {
  it("slides the text (width + 100) px over a line's life", () => {
    expect(scrollOffset(80, 0)).toBe(0);
    expect(scrollOffset(80, 75)).toBe(90);
    expect(scrollOffset(80, 149)).toBe(Math.trunc((149 * 180) / 150));
  });

  it("is the client's own scroll through the game's 100 px window", () => {
    for (const width of [0, 37, 80, 400]) {
      for (let cycle = 0; cycle < 300; cycle++) {
        expect(scrollOffset(width, cycle, 100)).toBe(Math.trunc(((cycle % 150) * (width + 100)) / 150));
      }
    }
  });

  it("keeps the game's pixel speed through a wider window, which takes longer to cross", () => {
    // 80 px of text moves 1.2 px a cycle, whatever the window.
    expect(scrollOffset(80, 75, 240)).toBe(90);
    for (let cycle = 0; cycle < 150; cycle++) {
      expect(scrollOffset(80, cycle, 240)).toBe(scrollOffset(80, cycle));
    }
    // (80 + 240) / 1.2 = 266.7 cycles: at 266 the text's last column is still in.
    expect(scrollOffset(80, 266, 240)).toBe(319);
    expect(scrollOffset(80, 267, 240)).toBe(0);
  });

  it("crosses the whole window: in at its right edge, out past its left, then again", () => {
    for (const width of [0, 1, 37, 80, 400]) {
      for (const frame of [100, 160, 240, 280]) {
        const offsets = Array.from({ length: 2000 }, (_, cycle) => scrollOffset(width, cycle, frame));
        // The text's left edge is at frame - offset: it starts just past the right edge.
        expect(offsets[0]).toBe(0);
        // It moves steadily left until the pass ends, then starts again.
        const life = offsets.findIndex((offset, cycle) => cycle > 0 && offset < offsets[cycle - 1]);
        expect(life).toBeGreaterThan(0);
        expect(offsets[life]).toBe(0);
        for (let cycle = 1; cycle < life; cycle++) {
          expect(offsets[cycle]).toBeGreaterThanOrEqual(offsets[cycle - 1]);
        }
        // Its last position still shows a column of it; one more step and it would be gone.
        expect(offsets[life - 1]).toBeLessThan(width + frame);
        expect((life * (width + 100)) / 150).toBeGreaterThanOrEqual(width + frame);
        if (frame === 100) expect(life).toBe(150);
      }
    }
  });
});

describe("scrollPass", () => {
  it("is the client's 150-cycle life through the game's 100 px window", () => {
    for (const width of [0, 37, 80, 400]) expect(scrollPass(width, 100)).toBe(150);
  });

  // Worked by hand: a pass is (text + window) px at the game's speed,
  // (text + 100) / 150 px a cycle, rounded up to a whole cycle.
  const PASSES: [text: number, window: number, cycles: number][] = [
    [80, 240, 267], // 320 / 1.2 = 266.7
    [0, 240, 360], // 240 / (100 / 150)
    [0, 160, 240], // 160 / (100 / 150)
    [400, 240, 192], // 640 / (500 / 150), exactly
    [37, 280, 348], // 317 / (137 / 150) = 347.1
    [1, 160, 240], // 161 / (101 / 150) = 239.1
    [189, 240, 223], // "Welcome to my log, traveller!": 429 / (289 / 150) = 222.7
  ];

  it("is one pass of the text across a wider window, at the game's pixel speed", () => {
    for (const [text, window, cycles] of PASSES) expect(scrollPass(text, window), `${text} through ${window}`).toBe(cycles);
  });

  it("is the cycle scrollOffset starts its next pass on", () => {
    for (const [text, window, cycles] of PASSES) {
      expect(scrollOffset(text, cycles - 1, window), `${text} through ${window}`).toBeGreaterThan(0);
      expect(scrollOffset(text, cycles, window), `${text} through ${window}`).toBe(0);
    }
  });
});

describe("cssColour", () => {
  it("is #rrggbb", () => {
    expect(cssColour(0x00b000)).toBe("#00b000");
  });
});
