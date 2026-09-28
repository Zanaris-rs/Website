import { describe, expect, it } from "vitest";

import {
  BAD_FIELDS,
  draftDirty,
  followMove,
  followRemove,
  goalsWith,
  linesWith,
  moved,
  pageAfterRemove,
  previewPersona,
  SAVE_MESSAGES,
  saveDraft,
  saveStatusText,
  typeHeadline,
  usedLines,
} from "./character-draft";
import { EMPTY_PERSONA } from "./persona";
import { checkSheetInput, checkWordsInput, type SheetInput, type WordsInput } from "./persona-input";

const draft: WordsInput = { headline: "", colour: 3, effect: 2, signatureEmote: null, dialogue: [] };

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
    expect(previewPersona({ ...EMPTY_PERSONA, goals: ["a", " ", "c"] }).goals).toEqual(["a", "c"]);
  });
});

describe("the save's refusals", () => {
  it("say muted in one sentence, and every bad_ code in another", () => {
    expect(SAVE_MESSAGES.muted).toBe("You're muted, so you can change picks but not words.");
    for (const code of Object.keys(BAD_FIELDS)) {
      expect(SAVE_MESSAGES[code]).toBe("Something didn't save; check the highlighted field.");
    }
  });
  it("cover every bad_ answer the three persona writers give", () => {
    expect(Object.keys(BAD_FIELDS).sort()).toEqual(
      [
        "bad_headline", "bad_colour", "bad_effect", "bad_emote", "bad_dialogue",
        "bad_title", "bad_examine", "bad_hangout", "bad_goals", "bad_god", "bad_key", "bad_facing",
      ].sort(),
    );
    expect(BAD_FIELDS).not.toHaveProperty("bad_clan");
  });
});

describe("draftDirty", () => {
  it("compares a draft with what was saved by value, not by identity", () => {
    const page = { mood: "happy" as const, emote: null, lines: ["hi"] };
    expect(draftDirty(draft, { ...draft })).toBe(false);
    expect(draftDirty({ ...draft, dialogue: [page] }, { ...draft, dialogue: [{ ...page, lines: ["hi"] }] })).toBe(false);
    expect(draftDirty({ ...draft, headline: "hi" }, draft)).toBe(true);
    expect(draftDirty({ ...draft, dialogue: [page] }, draft)).toBe(true);
  });
});

describe("saveStatusText", () => {
  it("says what is happening first, then a refusal, then saved, then unsaved", () => {
    const refused = { kind: "error" as const, message: "Pick a god from the list." };
    expect(saveStatusText(true, refused, true)).toBe("Saving…");
    expect(saveStatusText(false, refused, true)).toBe("Pick a god from the list.");
    expect(saveStatusText(false, { kind: "saved" }, false)).toBe("Saved.");
    expect(saveStatusText(false, null, true)).toBe("You have unsaved changes.");
    expect(saveStatusText(false, null, false)).toBe("");
  });
});

describe("saveDraft", () => {
  const sheet: SheetInput = { title: "  the Ready ", examine: "", hangout: "", goals: ["", "b"], god: null, homeTown: null };

  it("posts what the check made of the draft, and answers with it", async () => {
    const posted: unknown[] = [];
    const outcome = await saveDraft(sheet, checkSheetInput, async (value) => {
      posted.push(value);
      return { ok: true };
    });
    const value = { ...sheet, title: "the Ready", goals: ["b"] };
    expect(outcome).toEqual({ ok: true, value });
    expect(posted).toEqual([value]);
  });

  it("posts nothing when the check refuses, and gives its sentence with no field marked", async () => {
    let posts = 0;
    const outcome = await saveDraft({ ...draft, colour: 12 }, checkWordsInput, async () => {
      posts++;
      return { ok: true };
    });
    expect(outcome).toEqual({ ok: false, message: "Pick one of the twelve colours.", fields: [] });
    expect(posts).toBe(0);
  });

  it("marks the fields a refusal is about", async () => {
    const message = SAVE_MESSAGES.bad_emote;
    const outcome = await saveDraft(draft, checkWordsInput, async () => ({ ok: false, message, code: "bad_emote" }));
    expect(outcome).toEqual({ ok: false, message, fields: ["signatureEmote", "dialogue"] });
  });

  it("marks nothing for a refusal about no one field", async () => {
    const message = SAVE_MESSAGES.muted;
    const outcome = await saveDraft(draft, checkWordsInput, async () => ({ ok: false, message, code: "muted" }));
    expect(outcome).toEqual({ ok: false, message, fields: [] });
  });
});

describe("pageAfterRemove", () => {
  it("is the page now in the removed one's place, else the one before, else none", () => {
    expect(pageAfterRemove(1, 3)).toBe(1);
    expect(pageAfterRemove(0, 1)).toBe(0);
    expect(pageAfterRemove(3, 3)).toBe(2);
    expect(pageAfterRemove(0, 0)).toBeNull();
  });
});

describe("linesWith", () => {
  it("sets one of the four boxes and drops blank boxes at the end, keeping one", () => {
    expect(linesWith([""], 0, "Hi")).toEqual(["Hi"]);
    expect(linesWith(["Hi"], 2, "x")).toEqual(["Hi", "", "x"]);
    expect(linesWith(["Hi", "", "x"], 2, "")).toEqual(["Hi"]);
    expect(linesWith(["Hi"], 0, "")).toEqual([""]);
  });
  it("ignores a box that is not one of the four", () => {
    expect(linesWith(["Hi"], 4, "x")).toEqual(["Hi"]);
    expect(linesWith(["Hi"], -1, "x")).toEqual(["Hi"]);
  });
});

describe("usedLines", () => {
  it("counts up to the last line that is not blank", () => {
    expect(usedLines(["a", "", "b", " "])).toBe(3);
    expect(usedLines(["", ""])).toBe(0);
    expect(usedLines([])).toBe(0);
  });
});

describe("followMove", () => {
  it("follows the page the stage is playing when it moves, or when one moves past it", () => {
    expect(followMove(0, 3, 0, 1)).toBe(1);
    expect(followMove(1, 3, 0, 1)).toBe(0);
    expect(followMove(2, 3, 2, 1)).toBe(1);
    expect(followMove(1, 3, 2, 1)).toBe(2);
  });
  it("stays put when the move is elsewhere, or goes nowhere", () => {
    expect(followMove(2, 3, 0, 1)).toBe(2);
    expect(followMove(0, 3, 0, -1)).toBe(0);
    expect(followMove(2, 3, 2, 3)).toBe(2);
  });
});

describe("followRemove", () => {
  it("follows the page the stage is playing when one before it goes", () => {
    expect(followRemove(2, 0, 2)).toBe(1);
  });
  it("stays on the page when one after it goes", () => {
    expect(followRemove(0, 1, 2)).toBe(0);
  });
  it("moves to the page in the removed one's place, else the one before, else none", () => {
    expect(followRemove(1, 1, 2)).toBe(1);
    expect(followRemove(2, 2, 2)).toBe(1);
    expect(followRemove(0, 0, 0)).toBeNull();
  });
});
