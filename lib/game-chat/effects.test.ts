import { describe, expect, it } from "vitest";

import { CHAT_COLOUR_NAMES, colourAt, cssColour, scrollOffset, waveOffset } from "./effects";

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

describe("scrollOffset", () => {
  it("slides the text (width + 100) px over a line's life", () => {
    expect(scrollOffset(80, 0)).toBe(0);
    expect(scrollOffset(80, 75)).toBe(90);
    expect(scrollOffset(80, 149)).toBe(Math.trunc((149 * 180) / 150));
  });
});

describe("cssColour", () => {
  it("is #rrggbb", () => {
    expect(cssColour(0x00b000)).toBe("#00b000");
  });
});
