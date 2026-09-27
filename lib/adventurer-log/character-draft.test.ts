import { describe, expect, it } from "vitest";

import {
  BAD_FIELDS,
  goalsWith,
  longLines,
  moved,
  pageLines,
  previewPersona,
  SAVE_MESSAGES,
  typeHeadline,
} from "./character-draft";
import { EMPTY_PERSONA } from "./persona";
import type { PersonaInput } from "./persona-input";

const draft: PersonaInput = { ...EMPTY_PERSONA, headline: "", colour: 3, effect: 2 };

describe("typeHeadline", () => {
  it("moves a typed prefix into the pickers and keeps the text", () => {
    expect(typeHeadline(draft, "glow1:wave:hi")).toMatchObject({ headline: "hi", colour: 9, effect: 1 });
  });
  it("changes only what the prefix names", () => {
    expect(typeHeadline(draft, "wave:hi")).toMatchObject({ headline: "hi", colour: 3, effect: 1 });
    expect(typeHeadline(draft, "red:hi")).toMatchObject({ headline: "hi", colour: 1, effect: 2 });
    // yellow is colour 0: a prefix, even though it names the default
    expect(typeHeadline(draft, "yellow:hi")).toMatchObject({ headline: "hi", colour: 0, effect: 2 });
  });
  it("leaves plain text alone, a colon or not", () => {
    expect(typeHeadline(draft, "Selling: lobbies")).toMatchObject({ headline: "Selling: lobbies", colour: 3, effect: 2 });
    expect(typeHeadline(draft, "glow1")).toMatchObject({ headline: "glow1", colour: 3 });
  });
  it("reads the prefix as the client does", () => {
    expect(typeHeadline(draft, "green:red:hi")).toMatchObject({ headline: "red:hi", colour: 2, effect: 2 });
  });
});

describe("pageLines", () => {
  it("is one dialogue line per typed line, at most four", () => {
    expect(pageLines("a\nb")).toEqual(["a", "b"]);
    expect(pageLines("")).toEqual([""]);
    expect(pageLines("1\r\n2\n3\n4\n5")).toEqual(["1", "2", "3", "4"]);
  });
});

describe("longLines", () => {
  it("names the lines over sixty characters, as saved (trimmed)", () => {
    expect(longLines(["x".repeat(60), "x".repeat(61), ` ${"x".repeat(60)} `])).toEqual([1]);
  });
});

describe("moved", () => {
  it("moves one item and leaves the rest in order", () => {
    expect(moved(["a", "b", "c"], 0, 1)).toEqual(["b", "a", "c"]);
    expect(moved(["a", "b", "c"], 2, 1)).toEqual(["a", "c", "b"]);
  });
  it("does nothing past either end", () => {
    expect(moved(["a", "b"], 0, -1)).toEqual(["a", "b"]);
    expect(moved(["a", "b"], 1, 2)).toEqual(["a", "b"]);
  });
});

describe("goalsWith", () => {
  it("sets one of the three and drops trailing blanks", () => {
    expect(goalsWith([], 0, "99 Thieving")).toEqual(["99 Thieving"]);
    expect(goalsWith(["a"], 2, "c")).toEqual(["a", "", "c"]);
    expect(goalsWith(["a", "", "c"], 2, "")).toEqual(["a"]);
  });
});

describe("previewPersona", () => {
  it("shows only the goals that will be saved", () => {
    expect(previewPersona({ ...draft, goals: ["a", " ", "c"] }).goals).toEqual(["a", "c"]);
  });
});

describe("the save's refusals", () => {
  it("say muted in one sentence, and every bad_ code in another", () => {
    expect(SAVE_MESSAGES.muted).toBe("You're muted, so you can change picks but not words.");
    for (const code of Object.keys(BAD_FIELDS)) {
      expect(SAVE_MESSAGES[code]).toBe("Something didn't save; check the highlighted field.");
    }
  });
  it("cover every bad_ answer migration 16's save gives", () => {
    expect(Object.keys(BAD_FIELDS).sort()).toEqual(
      [
        "bad_headline", "bad_title", "bad_examine", "bad_hangout", "bad_clan", "bad_goals",
        "bad_god", "bad_key", "bad_emote", "bad_dialogue",
      ].sort(),
    );
  });
});
