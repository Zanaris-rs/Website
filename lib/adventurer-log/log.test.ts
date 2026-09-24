import { describe, expect, it } from "vitest";

import { MAX_ASSETS, parseBody } from "./body";
import { ADVENTURE_CATEGORIES, categorySlug, isHidden, maskOf } from "./categories";
import { eventIcon, itemByName } from "./events";
import { checkText, formatMonth, formatWhen, HEADLINE_MAX } from "./format";
import {
  cursorOf,
  logStatement,
  logStatusFor,
  parseCursor,
  parseLog,
  parsePost,
  parseReplies,
  parseTimeline,
  parseWrite,
  reportStatement,
  timelineStatement,
} from "./queries";

const HOSTILE = "x'); drop table account; --";

describe("parseBody", () => {
  it("turns known codes into pictures and leaves the rest as text", () => {
    expect(parseBody("Got [item:rune_platebody] at [skill:woodcutting] 60!")).toEqual([
      { t: "text", v: "Got " },
      { t: "item", id: 1127, name: "Rune platebody" },
      { t: "text", v: " at " },
      { t: "skill", stat: 8, name: "Woodcutting" },
      { t: "text", v: " 60!" },
    ]);
  });

  it("keeps an unknown code, HTML and anything else as the text it was", () => {
    expect(parseBody("[item:no_such_thing] <b>hi</b> [skill:sailing]")).toEqual([
      { t: "text", v: "[item:no_such_thing] <b>hi</b> [skill:sailing]" },
    ]);
  });

  it("knows runecrafting by both its names", () => {
    expect(parseBody("[skill:runecraft][skill:runecrafting]").map((token) => token.t)).toEqual(["skill", "skill"]);
  });

  it("shows at most MAX_ASSETS pictures", () => {
    const tokens = parseBody("[skill:attack]".repeat(MAX_ASSETS + 3));
    expect(tokens.filter((token) => token.t === "skill")).toHaveLength(MAX_ASSETS);
    expect(tokens[tokens.length - 1]).toEqual({ t: "text", v: "[skill:attack]".repeat(3) });
  });
});

describe("eventIcon", () => {
  it("finds a level-up's skill and a drop's item", () => {
    expect(eventIcon(1, "Levelled up woodcutting from 40 to 41")).toEqual({ type: "skill", stat: 8 });
    expect(eventIcon(1, "Levelled up runecraft from 1 to 2")).toEqual({ type: "skill", stat: 20 });
    expect(eventIcon(4, "Defeated a Greater demon and received a Rune platebody!")).toEqual({ type: "item", id: 1127 });
    expect(eventIcon(5, "Completed a Hard Clue Scroll.")).toEqual({ type: "item", id: 405 });
  });

  it("has no picture for what it cannot place", () => {
    expect(eventIcon(3, "Quest complete: Rune Mysteries")).toBeNull();
    expect(eventIcon(4, "Defeated a thing and received a Not An Item!")).toBeNull();
  });

  it("matches a name the item table disambiguates with a suffix", () => {
    expect(itemByName("Clue scroll")).toBe(2677);
  });
});

describe("categories", () => {
  it("are the engine's eight, each with a slug", () => {
    expect(ADVENTURE_CATEGORIES.map((category) => category.id).sort()).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(categorySlug(5)).toBe("clue");
    expect(categorySlug(99)).toBe("other");
  });

  it("make a bitmask the database takes", () => {
    const mask = maskOf([4, 5, 42]);
    expect(mask).toBe((1 << 4) | (1 << 5));
    expect(isHidden(mask, 5)).toBe(true);
    expect(isHidden(mask, 1)).toBe(false);
  });
});

describe("checkText", () => {
  it("trims as the database does and refuses what it refuses", () => {
    expect(checkText("  a\r\nb \n", "X", 10)).toEqual({ ok: true, value: "a\nb" });
    expect(checkText("", "X", 10).ok).toBe(false);
    expect(checkText("", "X", 10, { emptyOk: true })).toEqual({ ok: true, value: "" });
    expect(checkText("x".repeat(HEADLINE_MAX + 1), "X", HEADLINE_MAX).ok).toBe(false);
    expect(checkText("a\u0007", "X", 10).ok).toBe(false);
    expect(checkText("a\tb", "X", 10).ok).toBe(true);
    expect(checkText("a\nb", "X", 10, { oneLine: true }).ok).toBe(false);
    expect(checkText(3, "X", 10).ok).toBe(false);
  });
});

describe("dates", () => {
  it("are fixed UTC text, the same on the server and in the browser", () => {
    expect(formatWhen("2026-09-24T14:05:09Z")).toBe("24 Sep 2026, 14:05");
    expect(formatMonth("2026-09-24T14:05:09Z")).toBe("Sep 2026");
    expect(formatWhen("nonsense")).toBe("");
  });
});

describe("queries", () => {
  it("keep names in the values", () => {
    for (const statement of [
      logStatement(HOSTILE, HOSTILE),
      timelineStatement(HOSTILE, null, null),
      reportStatement(HOSTILE, "log", null, HOSTILE, HOSTILE),
    ]) {
      expect(statement.text).not.toContain("drop");
    }
  });

  it("read the header, always one row", () => {
    expect(parseLog([{ result: "not_found" }])).toEqual({ result: "not_found" });
    const ok = parseLog([
      {
        result: "ok",
        username: "hero",
        joined_at: new Date("2026-09-01T00:00:00Z"),
        headline: "h",
        about: "a",
        custom_css: "",
        css_disabled: false,
        hidden_categories: 16,
        is_owner: true,
        viewer_blocked: false,
        viewer_can_post: true,
        gender: null,
        kits: null,
        colours: null,
        worn: null,
      },
    ]);
    expect(ok).toMatchObject({ result: "ok", username: "hero", hiddenCategories: 16, isOwner: true, look: null });
    expect(() => parseLog([])).toThrow(/always one/);
    expect(() => parseLog([{ result: "maybe" }])).toThrow(/maybe/);
  });

  it("read a page and say whether there is another", () => {
    const rows = [
      { kind: "update", rank: 1, id: 7, at: "2026-09-24T12:00:00Z", category: null, body: "hi", reply_count: 2 },
      { kind: "event", rank: 0, id: 3, at: "2026-09-24T11:00:00Z", category: 1, body: "Levelled up", reply_count: null },
      { kind: "event", rank: 0, id: 2, at: "2026-09-24T10:00:00Z", category: 1, body: "Levelled up", reply_count: null },
    ];
    const page = parseTimeline(rows, 2);
    expect(page.more).toBe(true);
    expect(page.rows).toHaveLength(2);
    expect(cursorOf(page.rows[1])).toEqual({ at: "2026-09-24T11:00:00.000Z", rank: 0, id: 3 });
    expect(parseTimeline(rows, 5).more).toBe(false);
  });

  it("take a cursor from the URL only when all of it is sound", () => {
    expect(parseCursor(new URLSearchParams("at=2026-09-24T11:00:00Z&rank=0&id=3"))).toEqual({
      at: "2026-09-24T11:00:00.000Z",
      rank: 0,
      id: 3,
    });
    for (const bad of ["", "at=x&rank=0&id=3", "at=2026-09-24&rank=2&id=3", "at=2026-09-24&rank=0&id=-1"]) {
      expect(parseCursor(new URLSearchParams(bad))).toBeNull();
    }
  });

  it("read replies and post answers, and nothing undocumented", () => {
    expect(
      parseReplies([{ update_id: 1, id: 2, author: "fan", body: "Grats", created_at: "2026-09-24T12:00:00Z", can_delete: true }]),
    ).toEqual([{ updateId: 1, id: 2, author: "fan", body: "Grats", createdAt: "2026-09-24T12:00:00.000Z", canDelete: true }]);
    expect(parsePost([{ result: "ok", update_id: 9 }], "update_id", "post")).toEqual({ result: "ok", id: 9 });
    expect(parsePost([{ result: "muted", update_id: null }], "update_id", "post")).toEqual({ result: "muted", id: null });
    expect(() => parseWrite("whatever", "w")).toThrow(/whatever/);
  });

  it("give each answer a status", () => {
    expect(logStatusFor("bad_body")).toBe(400);
    expect(logStatusFor("muted")).toBe(403);
    expect(logStatusFor("not_found")).toBe(404);
    expect(logStatusFor("already")).toBe(409);
    expect(logStatusFor("rate_limited")).toBe(429);
    expect(logStatusFor("?")).toBe(500);
  });
});
