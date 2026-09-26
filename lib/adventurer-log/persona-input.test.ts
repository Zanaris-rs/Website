import { describe, expect, it } from "vitest";

import { EMPTY_PERSONA } from "./persona";
import { checkPersonaInput, personaSaveStatement } from "./persona-input";

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
    ["signatureEmote", { signatureEmote: "jig" }],
    ["too many pages", { dialogue: Array(6).fill({ mood: "happy", emote: null, lines: ["x"] }) }],
    ["too many lines", { dialogue: [{ mood: "happy", emote: null, lines: ["1", "2", "3", "4", "5"] }] }],
    ["a long line", { dialogue: [{ mood: "happy", emote: null, lines: ["x".repeat(61)] }] }],
    ["an empty page", { dialogue: [{ mood: "happy", emote: null, lines: [""] }] }],
    ["a bad mood", { dialogue: [{ mood: "goblinchat", emote: null, lines: ["x"] }] }],
  ])("refuses a bad %s", (_what, change) => {
    expect(checkPersonaInput({ ...good, ...change }).ok).toBe(false);
  });
  it("refuses no body", () => {
    expect(checkPersonaInput(null).ok).toBe(false);
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
