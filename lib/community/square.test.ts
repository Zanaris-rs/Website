import { describe, expect, it } from "vitest";

import { LINE_CYCLES } from "@/lib/adventurer-log/overhead";
import type { Look } from "@/lib/chathead/look";
import { scrollPass } from "@/lib/game-chat/effects";
import { stringWidth } from "@/lib/game-chat/metrics";
import type { PlayerSkill } from "@/lib/hiscores/api";

import {
  chatLeft,
  exactCombat,
  mouseOver,
  pickSitters,
  SQUARE_MAX,
  SQUARE_READ,
  speakers,
  squareSpot,
} from "./square";

const look = (gender: number): Look => ({
  gender,
  kits: [0, 10, 18, 26, 33, 36, 42],
  colours: [0, 0, 0, 0, 0],
  worn: [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
});

describe("the square", () => {
  it("is Varrock square, read from the directory's ten most recent, five at most", () => {
    const spot = squareSpot();
    expect(spot.key).toBe("varrock");
    expect(spot.photo!.length).toBeGreaterThanOrEqual(SQUARE_MAX);
    expect(SQUARE_READ).toBe(10);
    expect(SQUARE_MAX).toBe(5);
  });
});

describe("pickSitters", () => {
  const rows = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"].map((username) => ({ username }));

  it("keeps only those with a saved outfit, most recent first, and the next most recent fills in", () => {
    const looks = new Map([
      ["b", look(0)],
      ["d", look(1)],
      ["e", look(0)],
      ["g", look(0)],
      ["h", look(1)],
      ["j", look(0)],
    ]);
    expect(pickSitters(rows, looks).map(({ row }) => row.username)).toEqual(["b", "d", "e", "g", "h"]);
    expect(pickSitters(rows, looks)[1].look).toBe(looks.get("d"));
  });

  it("stands fewer when fewer have an outfit, and nobody when nobody has", () => {
    expect(pickSitters(rows, new Map([["c", look(0)]])).map(({ row }) => row.username)).toEqual(["c"]);
    expect(pickSitters(rows, new Map())).toEqual([]);
    expect(pickSitters([], new Map([["a", look(0)]]))).toEqual([]);
  });
});

const skill = (category: number, level: number): PlayerSkill => ({ category, level, rank: 1, xp: 0 });

describe("exactCombat", () => {
  it("is the level once all seven combat skills are on the hiscores", () => {
    const seven = [skill(0, 300), skill(1, 40), skill(2, 40), skill(3, 40), skill(4, 40), skill(5, 20), skill(6, 20), skill(7, 20)];
    expect(exactCombat(seven)).toBe(48);
  });

  it("is null while a missing skill leaves a range, as the Skills box shows one", () => {
    const noPrayer = [skill(1, 40), skill(2, 40), skill(3, 40), skill(4, 40), skill(5, 20), skill(7, 20)];
    expect(exactCombat(noPrayer)).toBeNull();
    expect(exactCombat([])).toBeNull();
  });
});

describe("speakers", () => {
  const sitter = (greeting: string, greetingColour = 0, greetingEffect = 0) => ({ greeting, greetingColour, greetingEffect });

  it("speak most recent first, the middle one, then outward as they stand", () => {
    const five = ["one", "two", "three", "four", "five"].map((line) => sitter(line));
    expect(speakers(five, 240).map((s) => [s.text, s.position])).toEqual([
      ["one", 2],
      ["two", 1],
      ["three", 3],
      ["four", 0],
      ["five", 4],
    ]);
  });

  it("skip anyone with nothing to say, who still stands in their place", () => {
    const three = [sitter(""), sitter("Hi", 9, 1), sitter("Bye")];
    expect(speakers(three, 240)).toEqual([
      { position: 0, text: "Hi", colour: 9, effect: 1, cycles: LINE_CYCLES },
      { position: 2, text: "Bye", colour: 0, effect: 0, cycles: LINE_CYCLES },
    ]);
    expect(speakers([sitter("")], 240)).toEqual([]);
  });

  it("give a scroll one pass across the whole frame, and every other line 150 cycles", () => {
    const text = "Selling lobbies 250 ea";
    const [scroll, wave] = speakers([sitter(text, 0, 2), sitter(text, 0, 1)], 240);
    expect(scroll.cycles).toBe(scrollPass(stringWidth(text, "b12"), 240));
    expect(scroll.cycles).toBeGreaterThan(LINE_CYCLES);
    expect(wave.cycles).toBe(150);
  });
});

describe("chatLeft", () => {
  it("centres a line over the head", () => {
    expect(chatLeft(120, 100, 0, 240)).toBe(0);
    expect(chatLeft(152, 100, 1, 240)).toBe(32);
  });

  it("keeps a line inside the frame at either side", () => {
    expect(chatLeft(23, 100, 0, 240)).toBe(-70);
    expect(chatLeft(217, 100, 0, 240)).toBe(70);
  });

  it("gives a line wider than the frame, and any scroll, the whole frame", () => {
    expect(chatLeft(23, 300, 0, 240)).toBe(0);
    expect(chatLeft(23, 50, 2, 240)).toBe(0);
  });
});

describe("mouseOver", () => {
  it("reads as the game's, with the level only when it is exact", () => {
    expect(mouseOver({ name: "Kitty Kat", combat: 45 })).toEqual({ text: "View log Kitty Kat", level: " (level-45)" });
    expect(mouseOver({ name: "Zezima", combat: null })).toEqual({ text: "View log Zezima", level: null });
  });
});
