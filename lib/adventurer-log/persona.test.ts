import { describe, expect, it } from "vitest";

import { EMPTY_PERSONA, parsePersona, personaStatement } from "./persona";

const row = {
  headline_colour: 9, headline_effect: 1, title: "the Unready", examine: "A scruffy archer.",
  hangout: "Varrock West bank", goals: ["99 Thieving"], god: "guthix",
  home_town: "varrock", scene: "varrock", facing: 5, signature_emote: "wave",
  dialogue: [{ mood: "happy", emote: "wave", lines: ["Hi!"] }, { mood: "sad", emote: null, lines: ["Bye."] }],
};

describe("personaStatement", () => {
  it("calls migration 17's read", () => {
    expect(personaStatement("zezima")).toEqual({ text: "select * from accounts.adventure_persona($1)", values: ["zezima"] });
  });
});

describe("parsePersona", () => {
  it("is empty for no row, facing you", () => {
    expect(parsePersona([])).toEqual(EMPTY_PERSONA);
    expect(EMPTY_PERSONA.facing).toBe(0);
  });
  it("reads a row", () => {
    expect(parsePersona([row])).toEqual({
      colour: 9, effect: 1, title: "the Unready", examine: "A scruffy archer.", hangout: "Varrock West bank",
      goals: ["99 Thieving"], god: "guthix", homeTown: "varrock", scene: "varrock", facing: 5, signatureEmote: "wave",
      dialogue: [{ mood: "happy", emote: "wave", lines: ["Hi!"] }, { mood: "sad", emote: null, lines: ["Bye."] }],
    });
  });
  it("has no clan or playstyle any more", () => {
    const persona = parsePersona([{ ...row, clan: "Lobster Pot", playstyle: "skiller" }]);
    expect(persona).not.toHaveProperty("clan");
    expect(persona).not.toHaveProperty("playstyle");
  });
  it("reads a key the site's lists no longer have, as long as it is shaped like a key", () => {
    // Migration 16 checks a key's shape, not the site's lists: a place
    // dropped later is still in the row, and the log must still load.
    expect(parsePersona([{ ...row, home_town: "zanaris", scene: "zanaris" }])).toMatchObject({
      homeTown: "zanaris", scene: "zanaris",
    });
  });
  it("throws on what migration 17 never answers", () => {
    expect(() => parsePersona([{ ...row, headline_colour: 12 }])).toThrow();
    expect(() => parsePersona([{ ...row, god: "bandos" }])).toThrow();
    expect(() => parsePersona([{ ...row, facing: 16 }])).toThrow(/facing/);
    expect(() => parsePersona([{ ...row, facing: null }])).toThrow(/facing/);
    expect(() => parsePersona([{ ...row, dialogue: [{ mood: "goblinchat", emote: null, lines: ["x"] }] }])).toThrow();
    expect(() => parsePersona([row, row])).toThrow();
  });
});
