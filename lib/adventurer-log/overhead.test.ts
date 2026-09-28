import { describe, expect, it } from "vitest";

import { CHAT_LIFE } from "@/lib/game-chat/effects";

import { LINE_CYCLES, lineAt, lineCyclesFor } from "./overhead";

const even = () => LINE_CYCLES;

describe("lineAt", () => {
  it("holds each line for its cycles, one after another", () => {
    const lines = ["Hi!", "Welcome to my log.", "Mind the partyhats."];
    expect(lineAt(lines, 0, even)).toEqual({ index: 0, startedAt: 0 });
    expect(lineAt(lines, 149, even)).toEqual({ index: 0, startedAt: 0 });
    expect(lineAt(lines, 150, even)).toEqual({ index: 1, startedAt: 150 });
    expect(lineAt(lines, 299, even)).toEqual({ index: 1, startedAt: 150 });
    expect(lineAt(lines, 449, even)).toEqual({ index: 2, startedAt: 300 });
  });

  it("starts the page again after its last line", () => {
    const lines = ["a", "b", "c"];
    expect(lineAt(lines, 450, even)).toEqual({ index: 0, startedAt: 450 });
    expect(lineAt(lines, 1000, even)).toEqual({ index: 0, startedAt: 900 });
    expect(lineAt(["only"], 151, even)).toEqual({ index: 0, startedAt: 150 });
  });

  it("gives each line its own length: a scroll line lasts its pass", () => {
    const byLength = (line: string) => line.length * 10;
    expect(lineAt(["ab", "abcd"], 19, byLength)).toEqual({ index: 0, startedAt: 0 });
    expect(lineAt(["ab", "abcd"], 25, byLength)).toEqual({ index: 1, startedAt: 20 });
    expect(lineAt(["ab", "abcd"], 65, byLength)).toEqual({ index: 0, startedAt: 60 });
  });

  it("is the first line at the start for no time, or time before the page began", () => {
    expect(lineAt(["a", "b"], -5, even)).toEqual({ index: 0, startedAt: 0 });
    expect(lineAt([], 500, even)).toEqual({ index: 0, startedAt: 0 });
  });

  it("never holds a line for less than a cycle", () => {
    expect(lineAt(["a", "b"], 1, () => 0)).toEqual({ index: 1, startedAt: 1 });
    expect(lineAt(["a", "b"], 2, () => 0)).toEqual({ index: 0, startedAt: 2 });
  });

  it("counts whole cycles: a fractional count, or a fractional line length, is taken down", () => {
    // 449.9 cycles is still in cycle 449, the last of line c; 450.3 is in cycle 450, line a again.
    expect(lineAt(["a", "b", "c"], 449.9, even)).toEqual({ index: 2, startedAt: 300 });
    expect(lineAt(["a", "b", "c"], 450.3, even)).toEqual({ index: 0, startedAt: 450 });
    // A line 150.7 cycles long lasts 150: b begins on cycle 150, and a again on 300.
    const long = () => 150.7;
    expect(lineAt(["a", "b"], 149.9, long)).toEqual({ index: 0, startedAt: 0 });
    expect(lineAt(["a", "b"], 150, long)).toEqual({ index: 1, startedAt: 150 });
    expect(lineAt(["a", "b"], 301.4, long)).toEqual({ index: 0, startedAt: 300 });
  });
});

describe("lineCyclesFor", () => {
  it("holds a line 150 cycles (3 s), the game's chat life, unless it scrolls", () => {
    expect(LINE_CYCLES).toBe(150);
    expect(LINE_CYCLES).toBe(CHAT_LIFE);
    for (const effect of [0, 1]) expect(lineCyclesFor(effect, 240)("Hello there")).toBe(150);
  });

  it("holds a scroll line for one whole pass through its window", () => {
    // 189 px in b12, as the client's own PixFont measured it (metrics.json's
    // samples): (189 + 240) px at (189 + 100) / 150 px a cycle is 222.7 cycles.
    const line = "Welcome to my log, traveller!";
    expect(lineCyclesFor(2, 240)(line)).toBe(223);
    // Through the game's own 100 px window, a pass is the chat life.
    expect(lineCyclesFor(2, 100)(line)).toBe(150);
  });
});
