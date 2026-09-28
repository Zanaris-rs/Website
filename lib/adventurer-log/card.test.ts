import { describe, expect, it } from "vitest";

import { cardMode, sheetRows } from "./card";
import { EMPTY_PERSONA } from "./persona";

describe("cardMode (the spec's chathead table)", () => {
  const page = { mood: "neutral" as const, emote: null, lines: ["hi"], colour: 0, effect: 0 };
  it("draws the figure whenever there is an outfit", () => {
    expect(cardMode({ hasOutfit: true, pages: [] })).toBe("figure");
    expect(cardMode({ hasOutfit: true, pages: [page] })).toBe("figure");
  });
  it("without an outfit, says the pages in a strip", () => {
    expect(cardMode({ hasOutfit: false, pages: [page] })).toBe("strip");
  });
  it("otherwise keeps today's chathead", () => {
    expect(cardMode({ hasOutfit: false, pages: [] })).toBe("chathead");
  });
});

describe("sheetRows", () => {
  it("leaves out what is empty, and names places and picks", () => {
    expect(sheetRows(EMPTY_PERSONA)).toEqual([]);
    expect(
      sheetRows({ ...EMPTY_PERSONA, homeTown: "al_kharid", god: "zamorak", goals: ["a", "b"], hangout: "GE" }),
    ).toEqual([
      { key: "home", label: "Home", value: "Al Kharid" },
      { key: "hangout", label: "Hangout", value: "GE" },
      { key: "god", label: "God", value: "Zamorak" },
      { key: "goals", label: "Goals", value: ["a", "b"] },
    ]);
  });
  it("drops a place key the site does not know", () => {
    expect(sheetRows({ ...EMPTY_PERSONA, homeTown: "zanaris" })).toEqual([]);
  });
});
