import { describe, expect, it } from "vitest";

import { activityOf } from "./activity";
import { excerpt } from "./body";
import {
  directoryCursorOf,
  directoryStatement,
  parseDirectory,
  parseDirectoryCursor,
  parseRecentReplies,
  recentRepliesStatement,
} from "./queries";

const HOSTILE = "x'); drop table account; --";

const EVENT = {
  username: "hero",
  headline: "Rune or bust",
  last_at: new Date("2026-09-25T10:00:00Z"),
  last_kind: "event",
  last_category: 1,
  last_body: "Levelled up cooking from 56 to 57",
};

const UPDATE = {
  username: "fan",
  headline: "",
  last_at: "2026-09-25T09:00:00Z",
  last_kind: "update",
  last_category: null,
  last_body: "Finally got my [item:rune_platebody]!",
};

describe("the directory", () => {
  it("asks for a page after a cursor, with nothing in the text", () => {
    expect(directoryStatement(null)).toEqual({
      text: "select * from accounts.adventure_log_directory($1, $2, $3)",
      values: [null, null, 30],
    });
    const after = directoryStatement({ at: "2026-09-25T10:00:00.000Z", username: HOSTILE }, 5);
    expect(after.text).not.toContain("drop");
    expect(after.values).toEqual(["2026-09-25T10:00:00.000Z", HOSTILE, 5]);
  });

  it("reads a page and uses the extra row only to say there is more", () => {
    const page = parseDirectory([EVENT, UPDATE], 1);
    expect(page.more).toBe(true);
    expect(page.rows).toEqual([
      {
        username: "hero",
        headline: "Rune or bust",
        lastAt: "2026-09-25T10:00:00.000Z",
        lastKind: "event",
        lastCategory: 1,
        lastBody: "Levelled up cooking from 56 to 57",
      },
    ]);
    expect(directoryCursorOf(page.rows[0])).toEqual({ at: "2026-09-25T10:00:00.000Z", username: "hero" });
    expect(parseDirectory([EVENT, UPDATE], 2).more).toBe(false);
    expect(parseDirectory([UPDATE]).rows[0].lastCategory).toBeNull();
  });

  it("throws on a row nobody documented", () => {
    expect(() => parseDirectory([{ ...EVENT, last_kind: "login" }])).toThrow(/login/);
    expect(() => parseDirectory([{ ...EVENT, last_category: null }])).toThrow(/last_category/);
    expect(() => parseDirectory([{ ...EVENT, last_at: "never" }])).toThrow(/last_at/);
  });

  it("takes a cursor from the URL only when all of it is sound", () => {
    expect(parseDirectoryCursor(new URLSearchParams("at=2026-09-25T10:00:00Z&after=hero"))).toEqual({
      at: "2026-09-25T10:00:00.000Z",
      username: "hero",
    });
    for (const bad of ["", "at=2026-09-25&after=", "at=x&after=hero", "at=2026-09-25&after=Hero", "at=2026-09-25&after=a%20b"]) {
      expect(parseDirectoryCursor(new URLSearchParams(bad))).toBeNull();
    }
  });

  it("says what a log last did", () => {
    const [event, update] = parseDirectory([EVENT, UPDATE]).rows;
    expect(activityOf(event)).toEqual({ icon: { type: "skill", stat: 7 }, activity: "Levelled up cooking from 56 to 57" });
    expect(activityOf(update)).toEqual({ icon: null, activity: "Posted an update: “Finally got my Rune platebody!”" });
  });
});

describe("excerpt", () => {
  it("names the pictures, folds the spacing and cuts long text", () => {
    expect(excerpt("got [skill:woodcutting]\n\n 60")).toBe("got Woodcutting 60");
    const long = excerpt("a".repeat(200), 10);
    expect(long).toHaveLength(10);
    expect(long.endsWith("…")).toBe(true);
  });
});

describe("recent replies", () => {
  it("are asked for by the owner's name, in the values", () => {
    const statement = recentRepliesStatement(HOSTILE);
    expect(statement.text).toBe("select * from accounts.adventure_log_recent_replies($1, $2)");
    expect(statement.values).toEqual([HOSTILE, 30]);
  });

  it("parse strictly", () => {
    expect(
      parseRecentReplies([
        {
          reply_id: 4,
          update_id: 1,
          author: "fan",
          body: "Grats",
          created_at: "2026-09-25T10:00:00Z",
          update_body: "Finally",
          author_blocked: true,
        },
      ]),
    ).toEqual([
      {
        replyId: 4,
        updateId: 1,
        author: "fan",
        body: "Grats",
        createdAt: "2026-09-25T10:00:00.000Z",
        updateBody: "Finally",
        authorBlocked: true,
      },
    ]);
    expect(() => parseRecentReplies([{ reply_id: "4" }])).toThrow(/reply_id/);
  });
});
