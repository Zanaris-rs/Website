import { describe, expect, it } from "vitest";

import { cardMode, sheetRows } from "./card";
import { EMPTY_PERSONA } from "./persona";

describe("cardMode (the spec's chathead table)", () => {
  const page = { mood: "neutral" as const, emote: null, lines: ["hi"] };
  it("draws the figure whenever there is an outfit", () => {
    expect(cardMode({ hasOutfit: true, headline: "", pages: [] })).toBe("figure");
    expect(cardMode({ hasOutfit: true, headline: "x", pages: [page] })).toBe("figure");
  });
  it("without an outfit, strips the headline when there are words", () => {
    expect(cardMode({ hasOutfit: false, headline: "x", pages: [] })).toBe("strip");
    expect(cardMode({ hasOutfit: false, headline: "", pages: [page] })).toBe("strip");
  });
  it("otherwise keeps today's chathead", () => {
    expect(cardMode({ hasOutfit: false, headline: "", pages: [] })).toBe("chathead");
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
