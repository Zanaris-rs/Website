import { describe, expect, it } from "vitest";

import { EMPTY_PERSONA, parsePersona, personaStatement } from "./persona";

const row = {
  headline_colour: 9, headline_effect: 1, title: "the Unready", examine: "A scruffy archer.",
  hangout: "Varrock West bank", clan: "Lobster Pot", goals: ["99 Thieving"], god: "guthix",
  home_town: "varrock", playstyle: "skiller", scene: "varrock", signature_emote: "wave",
  dialogue: [{ mood: "happy", emote: "wave", lines: ["Hi!"] }, { mood: "sad", emote: null, lines: ["Bye."] }],
};

describe("personaStatement", () => {
  it("calls migration 16's read", () => {
    expect(personaStatement("zezima")).toEqual({ text: "select * from accounts.adventure_persona($1)", values: ["zezima"] });
  });
});

describe("parsePersona", () => {
  it("is empty for no row", () => {
    expect(parsePersona([])).toEqual(EMPTY_PERSONA);
  });
  it("reads a row", () => {
    expect(parsePersona([row])).toEqual({
      colour: 9, effect: 1, title: "the Unready", examine: "A scruffy archer.", hangout: "Varrock West bank",
      clan: "Lobster Pot", goals: ["99 Thieving"], god: "guthix", homeTown: "varrock", playstyle: "skiller",
      scene: "varrock", signatureEmote: "wave",
      dialogue: [{ mood: "happy", emote: "wave", lines: ["Hi!"] }, { mood: "sad", emote: null, lines: ["Bye."] }],
    });
  });
  it("throws on what migration 16 never answers", () => {
    expect(() => parsePersona([{ ...row, headline_colour: 12 }])).toThrow();
    expect(() => parsePersona([{ ...row, god: "bandos" }])).toThrow();
    expect(() => parsePersona([{ ...row, dialogue: [{ mood: "goblinchat", emote: null, lines: ["x"] }] }])).toThrow();
    expect(() => parsePersona([row, row])).toThrow();
  });
});
