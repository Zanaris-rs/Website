import { expect, it } from "vitest";

import { EMOTES, EMOTE_SEQS, MOODS } from "./vocab";

it("matches the spec and migration 16's lists", () => {
  expect(EMOTES).toEqual(["yes", "no", "think", "bow", "angry", "cry", "laugh", "cheer", "wave", "beckon", "clap", "dance"]);
  expect(MOODS).toEqual(["neutral", "happy", "sad", "angry", "verymad", "laugh", "evillaugh", "shock", "confused", "bored", "shifty", "scared", "drunk", "quiz"]);
  expect(EMOTE_SEQS.dance).toBe("emote_dance");
});
