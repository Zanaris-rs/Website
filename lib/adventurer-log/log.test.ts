import { describe, expect, it } from "vitest";

import { MAX_ASSETS, parseBody } from "./body";
import { ADVENTURE_CATEGORIES, categorySlug, isHidden, maskOf } from "./categories";
import { eventIcon, itemByName } from "./events";
import { checkCss, checkText, CSS_MAX, formatMonth, formatWhen, HEADLINE_MAX } from "./format";
import {
  aboutSaveStatement,
  cursorOf,
  gzGiveStatement,
  gzTakeStatement,
  logStatement,
  logStatusFor,
  parseAboutSave,
  parseCursor,
  parseLog,
  parsePost,
  parseReplies,
  parsePinned,
  parseTimeline,
  parseWrite,
  pinnedStatement,
  pinStatement,
  reportStatement,
  timelineStatement,
  updateEditStatement,
} from "./queries";

const HOSTILE = "x'); drop table account; --";

/** A row of migration 15's timeline, as pg hands it over: an adventure. */
function eventRow(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    kind: "event",
    rank: 0,
    id: 3,
    at: new Date("2026-09-24T11:00:00Z"),
    category: 1,
    body: "Levelled up woodcutting from 40 to 41",
    reply_count: null,
    edited_at: null,
    gz_count: 0,
    gz_names: [],
    viewer_gz: false,
    ...over,
  };
}

/** ...and an update: no category, and the gz columns always 0, {} and false. */
function updateRow(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    kind: "update",
    rank: 1,
    id: 7,
    at: new Date("2026-09-24T12:00:00Z"),
    category: null,
    body: "hi",
    reply_count: 2,
    edited_at: null,
    gz_count: 0,
    gz_names: [],
    viewer_gz: false,
    ...over,
  };
}

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

describe("checkCss", () => {
  it("keeps the owner's lines where they wrote them, within the limit", () => {
    expect(checkCss("  .a {\r\n  color: red }\n\n")).toEqual({ ok: true, value: "  .a {\n  color: red }\n\n" });
    expect(checkCss("")).toEqual({ ok: true, value: "" });
    expect(checkCss("x".repeat(CSS_MAX))).toEqual({ ok: true, value: "x".repeat(CSS_MAX) });
    // CRLF counts once, as it will be stored
    expect(checkCss("\r\n".repeat(CSS_MAX)).ok).toBe(true);
    expect(checkCss("x".repeat(CSS_MAX + 1))).toEqual({
      ok: false,
      error: `Your stylesheet can be at most ${CSS_MAX} characters.`,
    });
  });

  it("is a bad request when it is not text", () => {
    for (const raw of [undefined, null, 3, ["a"], { css: "a" }]) {
      expect(checkCss(raw)).toEqual({ ok: false, error: "bad_request" });
    }
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
      timelineStatement(HOSTILE, HOSTILE, null, null),
      pinnedStatement(HOSTILE, HOSTILE),
      updateEditStatement(HOSTILE, 1, HOSTILE),
      pinStatement(HOSTILE, 1),
      reportStatement(HOSTILE, "log", null, HOSTILE, HOSTILE),
      aboutSaveStatement(HOSTILE, HOSTILE, HOSTILE, 0),
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
      updateRow({ id: 7, at: "2026-09-24T12:00:00Z", reply_count: 2 }),
      eventRow({ id: 3, at: "2026-09-24T11:00:00Z" }),
      eventRow({ id: 2, at: "2026-09-24T10:00:00Z" }),
    ];
    const page = parseTimeline(rows, 2);
    expect(page.more).toBe(true);
    expect(page.rows).toHaveLength(2);
    expect(cursorOf(page.rows[1])).toEqual({ at: "2026-09-24T11:00:00.000Z", rank: 0, id: 3 });
    expect(parseTimeline(rows, 5).more).toBe(false);
  });

  it("call the seven-argument timeline, with the filter's mask last", () => {
    expect(timelineStatement("hero", null, null, null)).toEqual({
      text: "select * from accounts.adventure_timeline($1, $2, $3, $4, $5, $6, $7)",
      values: ["hero", null, null, null, null, 30, null],
    });
    const cursor = { at: "2026-09-24T11:00:00.000Z", rank: 0 as const, id: 3 };
    expect(timelineStatement("hero", "fan", cursor, 8, 5).values).toEqual([
      "hero",
      "fan",
      "2026-09-24T11:00:00.000Z",
      0,
      3,
      5,
      8,
    ]);
  });

  it("read an adventure's gz and an update's edit time", () => {
    const page = parseTimeline([
      updateRow({ edited_at: new Date("2026-09-24T12:30:00Z") }),
      updateRow({ id: 6, edited_at: null }),
      eventRow({ gz_count: 2, gz_names: ["b0aty", "lynx_titan"], viewer_gz: true }),
      eventRow({ id: 2 }),
    ]);
    expect(page.rows).toEqual([
      { kind: "update", rank: 1, id: 7, at: "2026-09-24T12:00:00.000Z", body: "hi", replyCount: 2, editedAt: "2026-09-24T12:30:00.000Z" },
      { kind: "update", rank: 1, id: 6, at: "2026-09-24T12:00:00.000Z", body: "hi", replyCount: 2, editedAt: null },
      {
        kind: "event",
        rank: 0,
        id: 3,
        at: "2026-09-24T11:00:00.000Z",
        category: 1,
        body: "Levelled up woodcutting from 40 to 41",
        gz: { count: 2, names: ["b0aty", "lynx_titan"], mine: true },
      },
      {
        kind: "event",
        rank: 0,
        id: 2,
        at: "2026-09-24T11:00:00.000Z",
        category: 1,
        body: "Levelled up woodcutting from 40 to 41",
        gz: { count: 0, names: [], mine: false },
      },
    ]);
  });

  it("throw on a new column nobody documented", () => {
    for (const bad of [
      eventRow({ gz_names: "{b0aty}" }),
      eventRow({ gz_names: ["b0aty", 3] }),
      eventRow({ gz_names: null }),
      eventRow({ gz_count: "2" }),
      eventRow({ gz_count: null }),
      eventRow({ viewer_gz: null }),
      eventRow({ viewer_gz: "t" }),
      updateRow({ edited_at: undefined }),
      updateRow({ edited_at: "nonsense" }),
    ]) {
      expect(() => parseTimeline([bad]), JSON.stringify(bad)).toThrow(/adventure_timeline/);
    }
  });

  it("read the pinned update: none, or one update and never anything else", () => {
    expect(pinnedStatement("hero", null)).toEqual({
      text: "select * from accounts.adventure_pinned($1, $2)",
      values: ["hero", null],
    });
    expect(parsePinned([])).toBeNull();
    expect(parsePinned([updateRow({ id: 9, reply_count: 0, edited_at: "2026-09-24T13:00:00Z" })])).toEqual({
      kind: "update",
      rank: 1,
      id: 9,
      at: "2026-09-24T12:00:00.000Z",
      body: "hi",
      replyCount: 0,
      editedAt: "2026-09-24T13:00:00.000Z",
    });
    expect(() => parsePinned([eventRow()])).toThrow(/adventure_pinned/);
    expect(() => parsePinned([updateRow(), updateRow({ id: 8 })])).toThrow(/adventure_pinned/);
  });

  it("edit an update and pin one, or none", () => {
    expect(updateEditStatement("hero", 7, "new text")).toEqual({
      text: "select accounts.adventure_update_edit($1, $2, $3) as result",
      values: ["hero", 7, "new text"],
    });
    expect(pinStatement("hero", 7)).toEqual({
      text: "select accounts.adventure_log_pin($1, $2) as result",
      values: ["hero", 7],
    });
    expect(pinStatement("hero", null).values).toEqual(["hero", null]);
  });

  it("give a gz and take gz back, the ids as values", () => {
    expect(gzGiveStatement("fan", 3)).toEqual({
      text: "select accounts.adventure_gz_give($1, $2) as result",
      values: ["fan", 3],
    });
    expect(gzTakeStatement("fan", [3, 4])).toEqual({
      text: "select accounts.adventure_gz_take($1, $2::int[]) as result",
      values: ["fan", [3, 4]],
    });
    const many = Array.from({ length: 60 }, (_, i) => i + 1);
    expect(gzTakeStatement("fan", many).values[1]).toEqual(many.slice(0, 50));
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

  it("save About you in one statement, the filters only after the text", () => {
    const statement = aboutSaveStatement("hero", "h", "a", 16);
    expect(statement.values).toEqual(["hero", "h", "a", 16]);
    expect(statement.text.match(/accounts\.adventure_log_save\(/g)).toHaveLength(1);
    expect(statement.text).toContain("case when saved.result = 'ok' then accounts.adventure_log_set_hidden($1, $4) end");

    expect(parseAboutSave({ text_result: "ok", mask_result: "ok" })).toBe("ok");
    expect(parseAboutSave({ text_result: "muted", mask_result: null })).toBe("muted");
    expect(parseAboutSave({ text_result: "ok", mask_result: "bad_mask" })).toBe("bad_mask");
    expect(() => parseAboutSave({ text_result: "ok", mask_result: null })).toThrow(/set_hidden/);
    expect(() => parseAboutSave(undefined)).toThrow(/not a row/);
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
