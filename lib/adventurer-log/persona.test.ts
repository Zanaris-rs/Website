import { describe, expect, it } from "vitest";

import { EMPTY_PERSONA, parsePersona, personaStatement } from "./persona";

const row = {
  title: "the Unready", examine: "A scruffy archer.",
  hangout: "Varrock West bank", goals: ["99 Thieving"], god: "guthix",
  home_town: "varrock", scene: "varrock", facing: 5, signature_emote: "wave",
  dialogue: [
    { mood: "happy", emote: "wave", lines: ["Hi!"], colour: 9, effect: 1 },
    { mood: "sad", emote: null, lines: ["Bye."], colour: 0, effect: 0 },
  ],
};

describe("personaStatement", () => {
  it("calls migration 18's read", () => {
    expect(personaStatement("zezima")).toEqual({ text: "select * from accounts.adventure_persona($1)", values: ["zezima"] });
  });
});

describe("parsePersona", () => {
  it("is empty for no row, facing you", () => {
    expect(parsePersona([])).toEqual(EMPTY_PERSONA);
    expect(EMPTY_PERSONA.facing).toBe(0);
  });
  it("reads a row, each page with its own overhead colour and effect", () => {
    expect(parsePersona([row])).toEqual({
      title: "the Unready", examine: "A scruffy archer.", hangout: "Varrock West bank",
      goals: ["99 Thieving"], god: "guthix", homeTown: "varrock", scene: "varrock", facing: 5, signatureEmote: "wave",
      dialogue: [
        { mood: "happy", emote: "wave", lines: ["Hi!"], colour: 9, effect: 1 },
        { mood: "sad", emote: null, lines: ["Bye."], colour: 0, effect: 0 },
      ],
    });
  });
  it("has no persona-wide colour or effect any more", () => {
    const persona = parsePersona([{ ...row, headline_colour: 9, headline_effect: 1 }]);
    expect(persona).not.toHaveProperty("colour");
    expect(persona).not.toHaveProperty("effect");
  });
  it("reads a key the site's lists no longer have, as long as it is shaped like a key", () => {
    // Migration 16 checks a key's shape, not the site's lists: a place
    // dropped later is still in the row, and the log must still load.
    expect(parsePersona([{ ...row, home_town: "zanaris", scene: "zanaris" }])).toMatchObject({
      homeTown: "zanaris", scene: "zanaris",
    });
  });
  it("throws on what migration 18 never answers", () => {
    const page = row.dialogue[0];
    expect(() => parsePersona([{ ...row, god: "bandos" }])).toThrow();
    expect(() => parsePersona([{ ...row, facing: 16 }])).toThrow(/facing/);
    expect(() => parsePersona([{ ...row, facing: null }])).toThrow(/facing/);
    expect(() => parsePersona([{ ...row, dialogue: [{ ...page, mood: "goblinchat" }] }])).toThrow();
    // 18's adventure_dialogue always writes both, so a page without them is not 18's.
    expect(() => parsePersona([{ ...row, dialogue: [{ mood: "happy", emote: null, lines: ["x"] }] }])).toThrow(/colour/);
    expect(() => parsePersona([{ ...row, dialogue: [{ ...page, colour: 12 }] }])).toThrow(/colour/);
    expect(() => parsePersona([{ ...row, dialogue: [{ ...page, effect: 3 }] }])).toThrow(/effect/);
    expect(() => parsePersona([{ ...row, dialogue: [{ ...page, effect: undefined }] }])).toThrow(/effect/);
    expect(() => parsePersona([row, row])).toThrow();
  });
});
