import { describe, expect, it } from "vitest";

import {
  BODY_MAX,
  FIELD_MESSAGES,
  PREVIEW_MAX,
  SUBJECT_MAX,
  isPlainText,
  isTicketKind,
  messageKindLabel,
  normalizeText,
  previewLine,
  ticketKindLabel,
  ticketStatusLabel,
  unreadLabel,
  validateBody,
  validateSubject,
} from "./format";

/**
 * The wording and the caps. Two things are worth testing here and the rest is
 * dressing: that the validation agrees *exactly* with what the SQL will accept
 * (an app-side check that is stricter is a form nobody can submit; one that is
 * looser is a form that fails with a status code), and that nothing rendered
 * on a page can be an empty string where a sentence was expected.
 */

describe("validateSubject", () => {
  it("trims, and keeps what is left", () => {
    expect(validateSubject("  Dropped my logs  ")).toEqual({
      ok: true,
      value: "Dropped my logs",
    });
  });

  it("refuses an empty or whitespace-only subject", () => {
    expect(validateSubject("")).toEqual({ ok: false, error: "subject_empty" });
    expect(validateSubject("   \n ")).toEqual({
      ok: false,
      error: "subject_empty",
    });
  });

  it("accepts exactly the cap and refuses one past it", () => {
    expect(validateSubject("a".repeat(SUBJECT_MAX)).ok).toBe(true);
    expect(validateSubject("a".repeat(SUBJECT_MAX + 1))).toEqual({
      ok: false,
      error: "subject_long",
    });
  });

  it("trims before measuring, the way the SQL's btrim does", () => {
    // `accounts.ticket_open` stores btrim(subject) but measures length() on
    // what it was handed. Trimming first is what makes the two agree — without
    // it this would pass here and come back `invalid` from the database.
    const padded = `${" ".repeat(20)}${"a".repeat(SUBJECT_MAX)}${" ".repeat(20)}`;
    expect(validateSubject(padded).ok).toBe(true);
  });

  it("refuses control characters", () => {
    expect(validateSubject("a\u0000b")).toEqual({
      ok: false,
      error: "subject_charset",
    });
  });
});

describe("validateBody", () => {
  it("accepts newlines and tabs, which are text", () => {
    expect(validateBody("World 1\nabout 10:00\tit crashed")).toEqual({
      ok: true,
      value: "World 1\nabout 10:00\tit crashed",
    });
  });

  it("normalises CRLF, so a textarea's own line endings are not a rejection", () => {
    expect(validateBody("one\r\ntwo\rthree")).toEqual({
      ok: true,
      value: "one\ntwo\nthree",
    });
  });

  it("accepts exactly the cap and refuses one past it", () => {
    expect(validateBody("a".repeat(BODY_MAX)).ok).toBe(true);
    expect(validateBody("a".repeat(BODY_MAX + 1))).toEqual({
      ok: false,
      error: "body_long",
    });
  });

  it("refuses an escape character", () => {
    expect(validateBody("a\u001bb")).toEqual({
      ok: false,
      error: "body_charset",
    });
  });
});

describe("isPlainText", () => {
  it("allows a tab and a newline and nothing else below space", () => {
    expect(isPlainText("a\tb\nc")).toBe(true);
    for (const bad of ["\u0000", "\u0007", "\u000b", "\u001b", "\u007f"]) {
      expect(isPlainText(`a${bad}b`)).toBe(false);
    }
  });

  it("does not pretend to be an HTML filter", () => {
    // React escapes what it renders, so this is text, not markup. Saying so
    // here stops somebody later mistaking this for the sanitiser.
    expect(isPlainText("<script>alert(1)</script>")).toBe(true);
  });
});

describe("normalizeText", () => {
  it("leaves a lone newline alone", () => {
    expect(normalizeText("a\nb")).toBe("a\nb");
  });
});

describe("the labels", () => {
  it("names all five message kinds", () => {
    expect(messageKindLabel("welcome")).toBe("Welcome");
    expect(messageKindLabel("notice")).toBe("Notice");
    expect(messageKindLabel("ban")).toBe("Ban");
    expect(messageKindLabel("mute")).toBe("Mute");
    expect(messageKindLabel("reply")).toBe("Reply");
  });

  it("falls back to a word rather than showing a column value", () => {
    expect(messageKindLabel("something_new")).toBe("Message");
    expect(ticketKindLabel("something_new")).toBe("Ticket");
  });

  it("names the three ticket kinds", () => {
    expect(ticketKindLabel("bug")).toBe("Bug report");
    expect(ticketKindLabel("appeal")).toBe("Ban appeal");
    expect(ticketKindLabel("other")).toBe("Something else");
  });

  it("capitalises a status", () => {
    expect(ticketStatusLabel("open")).toBe("Open");
    expect(ticketStatusLabel("closed")).toBe("Closed");
  });

  it("knows a ticket kind from anything else", () => {
    expect(isTicketKind("bug")).toBe(true);
    expect(isTicketKind("BUG")).toBe(false);
    expect(isTicketKind(null)).toBe(false);
    expect(isTicketKind("")).toBe(false);
  });

  it("has a sentence for every field error", () => {
    for (const [code, sentence] of Object.entries(FIELD_MESSAGES)) {
      expect(sentence.length, code).toBeGreaterThan(0);
      expect(sentence.endsWith("."), code).toBe(true);
    }
  });
});

describe("previewLine", () => {
  it("flattens a multi-line preview onto one line", () => {
    expect(previewLine("World 1\n\nit crashed")).toBe("World 1 it crashed");
  });

  it("marks a preview the SQL had already cut", () => {
    // `accounts.messages` returns left(body, 160); a preview that came back at
    // exactly that length is one whose body kept going.
    const cut = "a".repeat(PREVIEW_MAX);
    expect(previewLine(cut).endsWith("…")).toBe(true);
    expect(previewLine(cut)).toHaveLength(PREVIEW_MAX);
  });

  it("leaves a short preview alone", () => {
    expect(previewLine("short")).toBe("short");
  });
});

describe("unreadLabel", () => {
  it("counts in words, singular and plural", () => {
    expect(unreadLabel(1)).toBe("1 unread message");
    expect(unreadLabel(3)).toBe("3 unread messages");
  });

  it("says nothing at zero, rather than '0 unread messages'", () => {
    expect(unreadLabel(0)).toBe("");
    expect(unreadLabel(-1)).toBe("");
  });
});
