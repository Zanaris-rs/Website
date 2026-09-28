import { describe, expect, it } from "vitest";

import { SCENES } from "@/lib/scenes/spots";

import { EMPTY_PERSONA } from "./persona";
import {
  checkSheetInput,
  checkStageInput,
  checkWordsInput,
  sheetOf,
  sheetSaveStatement,
  stageOf,
  stageSaveStatement,
  wordsOf,
  wordsSaveStatement,
} from "./persona-input";

const words = {
  headline: "  Selling lobbies  ", colour: 9, effect: 1, signatureEmote: "wave",
  dialogue: [{ mood: "happy", emote: "wave", lines: ["Hi!", ""] }],
};
const sheet = {
  title: "the Unready", examine: "", hangout: "", goals: ["99 Thieving", "  ", "Dragon Slayer"],
  god: "guthix", homeTown: "varrock",
};
const stage = { scene: "varrock", facing: 3 };

describe("checkWordsInput", () => {
  it("accepts, trims, and drops trailing blank lines", () => {
    const result = checkWordsInput(words);
    expect(result).toEqual({
      ok: true,
      value: {
        headline: "Selling lobbies", colour: 9, effect: 1, signatureEmote: "wave",
        dialogue: [{ mood: "happy", emote: "wave", lines: ["Hi!"] }],
      },
    });
  });
  it("takes a missing emote as none", () => {
    const result = checkWordsInput({ ...words, signatureEmote: undefined });
    expect(result.ok && result.value.signatureEmote).toBeNull();
  });
  it.each([
    ["headline", { headline: "x".repeat(81) }],
    ["colour", { colour: 12 }],
    ["effect", { effect: -1 }],
    ["signatureEmote", { signatureEmote: "jig" }],
    ["too many pages", { dialogue: Array(6).fill({ mood: "happy", emote: null, lines: ["x"] }) }],
    ["too many lines", { dialogue: [{ mood: "happy", emote: null, lines: ["1", "2", "3", "4", "5"] }] }],
    ["a long line", { dialogue: [{ mood: "happy", emote: null, lines: ["x".repeat(61)] }] }],
    ["an empty page", { dialogue: [{ mood: "happy", emote: null, lines: [""] }] }],
    ["an empty line in the middle", { dialogue: [{ mood: "happy", emote: null, lines: ["a", "", "b"] }] }],
    ["a bad mood", { dialogue: [{ mood: "goblinchat", emote: null, lines: ["x"] }] }],
    ["a bad page emote", { dialogue: [{ mood: "happy", emote: "jig", lines: ["x"] }] }],
  ])("refuses a bad %s", (_what, change) => {
    expect(checkWordsInput({ ...words, ...change }).ok).toBe(false);
  });
  it("refuses no body, and a body that is not an object", () => {
    for (const raw of [null, undefined, [], "hi", 3]) expect(checkWordsInput(raw).ok).toBe(false);
  });
});

describe("checkSheetInput", () => {
  it("accepts, trims, and drops blank goals", () => {
    expect(checkSheetInput(sheet)).toEqual({
      ok: true,
      value: {
        title: "the Unready", examine: "", hangout: "", goals: ["99 Thieving", "Dragon Slayer"],
        god: "guthix", homeTown: "varrock",
      },
    });
  });
  it("takes no god and no home town as none", () => {
    const result = checkSheetInput({ ...sheet, god: null, homeTown: undefined });
    expect(result.ok && [result.value.god, result.value.homeTown]).toEqual([null, null]);
  });
  it.each([
    ["title", { title: "x".repeat(25) }],
    ["examine", { examine: "a\nb" }],
    ["hangout", { hangout: "x".repeat(41) }],
    ["goals", { goals: ["a", "b", "c", "d"] }],
    ["goals that are not a list", { goals: "a" }],
    ["god", { god: "bandos" }],
    ["homeTown", { homeTown: "zanaris" }],
  ])("refuses a bad %s", (_what, change) => {
    expect(checkSheetInput({ ...sheet, ...change }).ok).toBe(false);
  });
  it("refuses no body", () => {
    expect(checkSheetInput(null).ok).toBe(false);
  });
});

describe("checkStageInput", () => {
  it("accepts every scene there is a backdrop for, and no scene", () => {
    for (const spot of SCENES.spots) {
      expect(checkStageInput({ ...stage, scene: spot.key }).ok).toBe(true);
    }
    expect(checkStageInput({ ...stage, scene: null })).toEqual({ ok: true, value: { scene: null, facing: 3 } });
  });
  it("accepts each of the sixteen facings", () => {
    for (let facing = 0; facing < 16; facing++) {
      expect(checkStageInput({ ...stage, facing })).toEqual({ ok: true, value: { scene: "varrock", facing } });
    }
  });
  it.each([
    ["scene", { scene: "Varrock" }],
    ["scene that is no place", { scene: "zanaris" }],
    ["scene that is not a key", { scene: 3 }],
    ["facing past the last", { facing: 16 }],
    ["facing below the first", { facing: -1 }],
    ["facing that is not whole", { facing: 1.5 }],
    ["facing that is text", { facing: "3" }],
    ["missing facing", { facing: undefined }],
  ])("refuses a bad %s", (_what, change) => {
    expect(checkStageInput({ ...stage, ...change }).ok).toBe(false);
  });
});

describe("the tabs' starting drafts", () => {
  const stored = {
    ...EMPTY_PERSONA, colour: 9, effect: 1, title: "the Unready", goals: ["99 Thieving"], god: "guthix" as const,
    homeTown: "varrock", scene: "varrock", facing: 7, signatureEmote: "wave" as const,
    dialogue: [{ mood: "happy" as const, emote: "wave" as const, lines: ["Hi!"] }],
  };
  it("give Words the headline and the words", () => {
    expect(wordsOf(stored, "Selling lobbies")).toEqual({
      headline: "Selling lobbies", colour: 9, effect: 1, signatureEmote: "wave", dialogue: stored.dialogue,
    });
  });
  it("give Sheet the sheet, and drop a home town the site no longer lists", () => {
    expect(sheetOf(stored)).toEqual({
      title: "the Unready", examine: "", hangout: "", goals: ["99 Thieving"], god: "guthix", homeTown: "varrock",
    });
    const stale = sheetOf({ ...stored, homeTown: "zanaris" });
    expect(stale.homeTown).toBeNull();
    expect(checkSheetInput(stale).ok).toBe(true);
  });
  it("give the stage its scene and facing, and drop a scene the site no longer lists", () => {
    expect(stageOf(stored)).toEqual({ scene: "varrock", facing: 7 });
    expect(stageOf({ ...stored, scene: "zanaris" })).toEqual({ scene: null, facing: 7 });
  });
});

describe("the three statements", () => {
  it("pass the Words tab's fields in the function's order, the dialogue as jsonb", () => {
    const result = checkWordsInput(words);
    if (!result.ok) throw new Error(result.error);
    expect(wordsSaveStatement("zezima", result.value)).toEqual({
      text: "select accounts.adventure_persona_save_words($1, $2, $3, $4, $5, $6::jsonb) as result",
      values: ["zezima", "Selling lobbies", 9, 1, "wave", JSON.stringify([{ mood: "happy", emote: "wave", lines: ["Hi!"] }])],
    });
  });
  it("pass the Sheet tab's fields in the function's order, the goals as jsonb", () => {
    const result = checkSheetInput(sheet);
    if (!result.ok) throw new Error(result.error);
    expect(sheetSaveStatement("zezima", result.value)).toEqual({
      text: "select accounts.adventure_persona_save_sheet($1, $2, $3, $4, $5::jsonb, $6, $7) as result",
      values: ["zezima", "the Unready", "", "", JSON.stringify(["99 Thieving", "Dragon Slayer"]), "guthix", "varrock"],
    });
  });
  it("pass the stage's scene and facing", () => {
    expect(stageSaveStatement("zezima", { scene: null, facing: 15 })).toEqual({
      text: "select accounts.adventure_persona_save_stage($1, $2, $3) as result",
      values: ["zezima", null, 15],
    });
  });
});
