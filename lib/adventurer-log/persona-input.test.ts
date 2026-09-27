import { describe, expect, it } from "vitest";

import { SCENES } from "@/lib/scenes/spots";

import { EMPTY_PERSONA } from "./persona";
import { checkPersonaInput, editablePersona, type PersonaInput, personaSaveStatement } from "./persona-input";

const good = {
  ...EMPTY_PERSONA, headline: "  Selling lobbies  ", colour: 9, effect: 1, title: "the Unready",
  goals: ["99 Thieving", "  ", "Dragon Slayer"], god: "guthix", homeTown: "varrock", playstyle: "skiller",
  scene: "varrock", signatureEmote: "wave",
  dialogue: [{ mood: "happy", emote: "wave", lines: ["Hi!", ""] }],
};

describe("checkPersonaInput", () => {
  it("accepts, trims, and drops blank goals and trailing blank lines", () => {
    const result = checkPersonaInput(good);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.headline).toBe("Selling lobbies");
    expect(result.value.goals).toEqual(["99 Thieving", "Dragon Slayer"]);
    expect(result.value.dialogue).toEqual([{ mood: "happy", emote: "wave", lines: ["Hi!"] }]);
  });
  it.each([
    ["colour", { colour: 12 }],
    ["effect", { effect: -1 }],
    ["title", { title: "x".repeat(25) }],
    ["examine", { examine: "a\nb" }],
    ["goals", { goals: ["a", "b", "c", "d"] }],
    ["god", { god: "bandos" }],
    ["homeTown", { homeTown: "zanaris" }],
    ["playstyle", { playstyle: "ironman" }],
    ["scene", { scene: "Varrock" }],
    ["scene that is no place", { scene: "zanaris" }],
    ["scene that is not a key", { scene: 3 }],
    ["signatureEmote", { signatureEmote: "jig" }],
    ["too many pages", { dialogue: Array(6).fill({ mood: "happy", emote: null, lines: ["x"] }) }],
    ["too many lines", { dialogue: [{ mood: "happy", emote: null, lines: ["1", "2", "3", "4", "5"] }] }],
    ["a long line", { dialogue: [{ mood: "happy", emote: null, lines: ["x".repeat(61)] }] }],
    ["an empty page", { dialogue: [{ mood: "happy", emote: null, lines: [""] }] }],
    ["a bad mood", { dialogue: [{ mood: "goblinchat", emote: null, lines: ["x"] }] }],
  ])("refuses a bad %s", (_what, change) => {
    expect(checkPersonaInput({ ...good, ...change }).ok).toBe(false);
  });
  it("accepts every scene there is a backdrop for, and no scene", () => {
    for (const spot of SCENES.spots) {
      expect(checkPersonaInput({ ...good, scene: spot.key }).ok).toBe(true);
    }
    expect(checkPersonaInput({ ...good, scene: null }).ok).toBe(true);
  });
  it("refuses no body", () => {
    expect(checkPersonaInput(null).ok).toBe(false);
  });
});

describe("editablePersona (the stored persona, as the editor starts from it)", () => {
  const stored: PersonaInput = {
    ...EMPTY_PERSONA, headline: "Selling lobbies", colour: 9, effect: 1, title: "the Unready", goals: ["99 Thieving"],
    god: "guthix", homeTown: "varrock", playstyle: "skiller", scene: "varrock", signatureEmote: "wave",
    dialogue: [{ mood: "happy", emote: "wave", lines: ["Hi!"] }],
  };
  it("keeps picks that are on the site's lists", () => {
    expect(editablePersona(stored)).toEqual(stored);
  });
  it("drops a home town, playstyle or scene the site no longer lists, so the first Save is not refused", () => {
    const stale = { ...stored, homeTown: "zanaris", playstyle: "ironman", scene: "zanaris" };
    expect(checkPersonaInput(stale).ok).toBe(false);
    const cleaned = editablePersona(stale);
    expect(cleaned).toEqual({ ...stored, homeTown: null, playstyle: null, scene: null });
    expect(checkPersonaInput(cleaned).ok).toBe(true);
  });
  it("keeps no picks as none", () => {
    const none = { ...stored, homeTown: null, playstyle: null, scene: null };
    expect(editablePersona(none)).toEqual(none);
  });
});

describe("personaSaveStatement", () => {
  it("passes every field, the JSON ones as jsonb", () => {
    const result = checkPersonaInput(good);
    if (!result.ok) throw new Error(result.error);
    const statement = personaSaveStatement("zezima", result.value);
    expect(statement.text).toBe(
      "select accounts.adventure_persona_save($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12, $13, $14, $15::jsonb) as result",
    );
    expect(statement.values).toEqual([
      "zezima", "Selling lobbies", 9, 1, "the Unready", "", "", "",
      JSON.stringify(["99 Thieving", "Dragon Slayer"]), "guthix", "varrock", "skiller", "varrock", "wave",
      JSON.stringify([{ mood: "happy", emote: "wave", lines: ["Hi!"] }]),
    ]);
  });
});
