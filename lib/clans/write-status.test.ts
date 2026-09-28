import { describe, expect, it, vi } from "vitest";

import { clearedIn, describedBy, fieldIn, mayStart, refusal, textIn, type WriteStatus } from "./write-status";

type Box = "members" | "page";

describe("refusal", () => {
  it("keeps the sentence, and the field a code was about", () => {
    expect(refusal<Box>("page", "That crest cannot be used.", "bad_crest")).toEqual({
      box: "page",
      text: "That crest cannot be used.",
      field: "crest",
    });
  });

  it("names no field for a refusal about the player, or one made in the browser", () => {
    expect(refusal<Box>("page", "You are muted.", "muted").field).toBeNull();
    expect(refusal<Box>("members", "There is no player by that name.").field).toBeNull();
  });
});

describe("a box reads only its own refusal", () => {
  const status: WriteStatus<Box> = refusal<Box>("page", "Taken.", "taken");

  it("gives the sentence and the field to that box, and nothing to the others", () => {
    expect(textIn(status, "page")).toBe("Taken.");
    expect(fieldIn(status, "page")).toBe("name");
    expect(textIn(status, "members")).toBe("");
    expect(fieldIn(status, "members")).toBeNull();
    expect(textIn(null, "page")).toBe("");
    expect(fieldIn(null, "page")).toBeNull();
  });

  it("clears it when that box's fields are edited, and leaves another box's alone", () => {
    expect(clearedIn(status, "page")).toBeNull();
    expect(clearedIn(status, "members")).toBe(status);
    expect(clearedIn(null, "page")).toBeNull();
  });
});

describe("mayStart", () => {
  it("sends nothing while another write is out, and asks no question then", () => {
    const ask = vi.fn(() => true);
    expect(mayStart(true, "Disband?", ask)).toBe(false);
    expect(ask).not.toHaveBeenCalled();
  });

  it("asks the question, when there is one, and a no sends nothing", () => {
    expect(mayStart(false, "Disband?", () => false)).toBe(false);
    const ask = vi.fn(() => true);
    expect(mayStart(false, "Disband?", ask)).toBe(true);
    expect(ask).toHaveBeenCalledWith("Disband?");
  });

  it("sends at once with no question", () => {
    const ask = vi.fn(() => false);
    expect(mayStart(false, undefined, ask)).toBe(true);
    expect(ask).not.toHaveBeenCalled();
  });
});

describe("describedBy", () => {
  it("joins the ids that are there, and is nothing when none are", () => {
    expect(describedBy("name-hint", false, "page-status")).toBe("name-hint page-status");
    expect(describedBy("name-hint", undefined)).toBe("name-hint");
    expect(describedBy(false, null, undefined)).toBeUndefined();
  });
});
