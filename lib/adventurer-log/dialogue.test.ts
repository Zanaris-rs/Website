import { expect, it } from "vitest";

import { dialoguePages } from "./dialogue";
import { EMPTY_PERSONA } from "./persona";

it("uses the owner's pages when there are any", () => {
  const pages = [{ mood: "happy" as const, emote: "wave" as const, lines: ["Hi"] }];
  expect(dialoguePages({ ...EMPTY_PERSONA, dialogue: pages }, "headline")).toEqual(pages);
});

it("falls back to the headline as one plain, neutral page", () => {
  expect(dialoguePages(EMPTY_PERSONA, "Selling lobbies")).toEqual([
    { mood: "neutral", emote: null, lines: ["Selling lobbies"] },
  ]);
});

it("has nothing to say with neither", () => {
  expect(dialoguePages(EMPTY_PERSONA, "")).toEqual([]);
});
