import { describe, expect, it } from "vitest";

import { SCENES } from "@/lib/scenes/spots";

import { ABOUT_MAX } from "./format";
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

const page = { mood: "happy", emote: "wave", lines: ["Hi!", ""], colour: 9, effect: 1 };
const words = { signatureEmote: "wave", dialogue: [page] };
const sheet = {
  title: "the Unready", examine: "", hangout: "", goals: ["99 Thieving", "  ", "Dragon Slayer"],
  god: "guthix", homeTown: "varrock", about: "  Cook, party host.\r\nFinder of lost hats.  ",
};
const stage = { scene: "varrock", facing: 3 };

describe("checkWordsInput", () => {
  it("accepts, trims, and drops trailing blank lines, keeping each page's look", () => {
    expect(checkWordsInput(words)).toEqual({
      ok: true,
      value: { signatureEmote: "wave", dialogue: [{ mood: "happy", emote: "wave", lines: ["Hi!"], colour: 9, effect: 1 }] },
    });
  });
  it("takes a missing emote as none", () => {
    const result = checkWordsInput({ ...words, signatureEmote: undefined });
    expect(result.ok && result.value.signatureEmote).toBeNull();
  });
  it("has no headline, and leaves one sent by an old tab out of what it saves", () => {
    const result = checkWordsInput({ ...words, headline: "Selling lobbies", colour: 9, effect: 1 });
    expect(result.ok && Object.keys(result.value).sort()).toEqual(["dialogue", "signatureEmote"]);
  });
  it.each([
    ["signatureEmote", { signatureEmote: "jig" }],
    ["too many pages", { dialogue: Array(6).fill(page) }],
    ["too many lines", { dialogue: [{ ...page, lines: ["1", "2", "3", "4", "5"] }] }],
    ["a long line", { dialogue: [{ ...page, lines: ["x".repeat(61)] }] }],
    ["an empty page", { dialogue: [{ ...page, lines: [""] }] }],
    ["an empty line in the middle", { dialogue: [{ ...page, lines: ["a", "", "b"] }] }],
    ["a bad mood", { dialogue: [{ ...page, mood: "goblinchat" }] }],
    ["a bad page emote", { dialogue: [{ ...page, emote: "jig" }] }],
    ["a colour past glow3", { dialogue: [{ ...page, colour: 12 }] }],
    ["a colour that is text", { dialogue: [{ ...page, colour: "9" }] }],
    ["a missing colour", { dialogue: [{ ...page, colour: undefined }] }],
    ["an effect past scroll", { dialogue: [{ ...page, effect: 3 }] }],
    ["a missing effect", { dialogue: [{ ...page, effect: undefined }] }],
  ])("refuses a bad %s", (_what, change) => {
    expect(checkWordsInput({ ...words, ...change }).ok).toBe(false);
  });
  it("names the page and the overhead in its refusals", () => {
    expect(checkWordsInput({ ...words, dialogue: [page, { ...page, colour: 12 }] })).toEqual({
      ok: false,
      error: "Page 2: pick an overhead colour from the list.",
    });
    expect(checkWordsInput({ ...words, dialogue: [{ ...page, effect: -1 }] })).toEqual({
      ok: false,
      error: "Page 1: pick an overhead effect from the list.",
    });
  });
  it("refuses no body, and a body that is not an object", () => {
    for (const raw of [null, undefined, [], "hi", 3]) expect(checkWordsInput(raw).ok).toBe(false);
  });
});

describe("checkSheetInput", () => {
  it("accepts, trims, drops blank goals, and keeps About's lines", () => {
    expect(checkSheetInput(sheet)).toEqual({
      ok: true,
      value: {
        title: "the Unready", examine: "", hangout: "", goals: ["99 Thieving", "Dragon Slayer"],
        god: "guthix", homeTown: "varrock", about: "Cook, party host.\nFinder of lost hats.",
      },
    });
  });
  it("takes no god and no home town as none, and an empty About as none", () => {
    const result = checkSheetInput({ ...sheet, god: null, homeTown: undefined, about: "" });
    expect(result.ok && [result.value.god, result.value.homeTown, result.value.about]).toEqual([null, null, ""]);
  });
  it("takes About up to its limit", () => {
    expect(checkSheetInput({ ...sheet, about: "x".repeat(ABOUT_MAX) }).ok).toBe(true);
  });
  it.each([
    ["title", { title: "x".repeat(25) }],
    ["examine", { examine: "a\nb" }],
    ["hangout", { hangout: "x".repeat(41) }],
    ["goals", { goals: ["a", "b", "c", "d"] }],
    ["goals that are not a list", { goals: "a" }],
    ["god", { god: "bandos" }],
    ["homeTown", { homeTown: "zanaris" }],
    ["About past its limit", { about: "x".repeat(ABOUT_MAX + 1) }],
    ["About with a control character", { about: "a\u0007b" }],
    // A Sheet from before migration 18 sends none: refused, not saved as empty.
    ["missing About", { about: undefined }],
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
    ...EMPTY_PERSONA, title: "the Unready", goals: ["99 Thieving"], god: "guthix" as const,
    homeTown: "varrock", scene: "varrock", facing: 7, signatureEmote: "wave" as const,
    dialogue: [{ mood: "happy" as const, emote: "wave" as const, lines: ["Hi!"], colour: 9, effect: 1 }],
  };
  it("give Words the signature emote and the pages", () => {
    expect(wordsOf(stored)).toEqual({ signatureEmote: "wave", dialogue: stored.dialogue });
  });
  it("give Sheet the sheet and the log's About, and drop a home town the site no longer lists", () => {
    expect(sheetOf(stored, "Cook.")).toEqual({
      title: "the Unready", examine: "", hangout: "", goals: ["99 Thieving"], god: "guthix", homeTown: "varrock",
      about: "Cook.",
    });
    const stale = sheetOf({ ...stored, homeTown: "zanaris" }, "");
    expect(stale.homeTown).toBeNull();
    expect(checkSheetInput(stale).ok).toBe(true);
  });
  it("give the stage its scene and facing, and drop a scene the site no longer lists", () => {
    expect(stageOf(stored)).toEqual({ scene: "varrock", facing: 7 });
    expect(stageOf({ ...stored, scene: "zanaris" })).toEqual({ scene: null, facing: 7 });
  });
});

describe("the three statements", () => {
  it("pass the Words tab's two fields to migration 18's three-argument writer, the dialogue as jsonb", () => {
    const result = checkWordsInput(words);
    if (!result.ok) throw new Error(result.error);
    expect(wordsSaveStatement("zezima", result.value)).toEqual({
      text: "select accounts.adventure_persona_save_words($1, $2, $3::jsonb) as result",
      values: [
        "zezima",
        "wave",
        JSON.stringify([{ mood: "happy", emote: "wave", lines: ["Hi!"], colour: 9, effect: 1 }]),
      ],
    });
  });
  it("pass the Sheet tab's fields to migration 18's eight-argument writer, About last", () => {
    const result = checkSheetInput(sheet);
    if (!result.ok) throw new Error(result.error);
    expect(sheetSaveStatement("zezima", result.value)).toEqual({
      text: "select accounts.adventure_persona_save_sheet($1, $2, $3, $4, $5::jsonb, $6, $7, $8) as result",
      values: [
        "zezima", "the Unready", "", "", JSON.stringify(["99 Thieving", "Dragon Slayer"]), "guthix", "varrock",
        "Cook, party host.\nFinder of lost hats.",
      ],
    });
  });
  it("pass the stage's scene and facing", () => {
    expect(stageSaveStatement("zezima", { scene: null, facing: 15 })).toEqual({
      text: "select accounts.adventure_persona_save_stage($1, $2, $3) as result",
      values: ["zezima", null, 15],
    });
  });
});
