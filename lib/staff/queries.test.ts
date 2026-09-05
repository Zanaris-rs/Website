import { describe, expect, it } from "vitest";

import {
  DEFAULT_INBOX_STATUS,
  INBOX_STATUSES,
  parseInboxRow,
  parseInboxStatus,
  parseReportRow,
  parseSince,
  parseStaffNoticeResult,
  parseStaffReplyResult,
  parseStaffThread,
  staffInboxStatement,
  staffNoticeStatement,
  staffReplyStatement,
  staffReportsStatement,
  staffThreadStatement,
} from "./queries";

/**
 * The staff statements, asserted character for character like the player's.
 * There is one extra thing worth proving on this side: that the inbox never
 * sends a NULL status.
 */
describe("the statements", () => {
  it("asks the inbox for a status explicitly, never by omission", () => {
    // `accounts.staff_inbox(p_actor, p_status default 'open')` matches
    // `t.status = p_status`. A default only applies to an argument that is
    // *absent*; a SQL NULL compares to nothing, so the inbox would come back
    // empty and read as a quiet day rather than as a bug.
    expect(staffInboxStatement("admin")).toEqual({
      text: "select * from accounts.staff_inbox($1, $2)",
      values: ["admin", "open"],
    });
    expect(staffInboxStatement("admin", "all")).toEqual({
      text: "select * from accounts.staff_inbox($1, $2)",
      values: ["admin", "all"],
    });
    for (const status of INBOX_STATUSES) {
      expect(staffInboxStatement("admin", status).values[1]).toBe(status);
      expect(staffInboxStatement("admin", status).values[1]).not.toBeNull();
    }
  });

  it("opens a thread with the actor first and the id second", () => {
    expect(staffThreadStatement("admin", 12)).toEqual({
      text: "select * from accounts.staff_thread($1, $2)",
      values: ["admin", 12],
    });
  });

  it("replies with the close flag last, as a boolean", () => {
    expect(staffReplyStatement("admin", 12, "Fixed.", true)).toEqual({
      text: "select accounts.staff_reply($1, $2, $3, $4) as result",
      values: ["admin", 12, "Fixed.", true],
    });
    expect(staffReplyStatement("admin", 12, "Fixed.", false).values[3]).toBe(
      false,
    );
  });

  it("sends a notice with the actor's candidate hash second", () => {
    // Second, not last: this is the compare-and-set against the actor's own
    // password, and a shifted parameter would hand the hash to the function as
    // the recipient's username.
    expect(
      staffNoticeStatement("admin", "$2b$10$hash", "bob_smith", "S", "B"),
    ).toEqual({
      text: "select accounts.staff_notice($1, $2, $3, $4, $5) as result",
      values: ["admin", "$2b$10$hash", "bob_smith", "S", "B"],
    });
  });

  it("asks for reports since null by default, letting the function decide", () => {
    expect(staffReportsStatement("admin")).toEqual({
      text: "select * from accounts.staff_reports($1, $2)",
      values: ["admin", null],
    });
    const since = new Date("2026-09-01T00:00:00.000Z");
    expect(staffReportsStatement("admin", since).values[1]).toBe(since);
  });

  it("never interpolates: every value is a placeholder", () => {
    const nasty = "'; drop table ticket; --";
    for (const statement of [
      staffInboxStatement(nasty),
      staffThreadStatement(nasty, 1),
      staffReplyStatement(nasty, 1, nasty, false),
      staffNoticeStatement(nasty, nasty, nasty, nasty, nasty),
      staffReportsStatement(nasty),
    ]) {
      expect(statement.text).not.toContain(nasty);
      expect(statement.text).not.toContain("drop table");
      expect(statement.values).toContain(nasty);
    }
  });

  it("passes no `name`, so the transaction pooler never sees a prepare", () => {
    for (const statement of [
      staffInboxStatement("a"),
      staffThreadStatement("a", 1),
      staffReplyStatement("a", 1, "b", false),
      staffNoticeStatement("a", "b", "c", "d", "e"),
      staffReportsStatement("a"),
    ]) {
      expect(Object.keys(statement).sort()).toEqual(["text", "values"]);
    }
  });
});

describe("parseInboxStatus", () => {
  it("takes the three the function understands", () => {
    expect(parseInboxStatus("open")).toBe("open");
    expect(parseInboxStatus("closed")).toBe("closed");
    expect(parseInboxStatus("all")).toBe("all");
  });

  it("falls back to open for anything else, never passing it through", () => {
    // A status the function does not know matches no row, so a typo in the
    // query string would empty the inbox instead of showing it.
    for (const bad of [null, undefined, "", "OPEN", "'; --", 1]) {
      expect(parseInboxStatus(bad)).toBe(DEFAULT_INBOX_STATUS);
    }
    expect(DEFAULT_INBOX_STATUS).toBe("open");
  });
});

describe("parseSince", () => {
  it("reads an ISO date", () => {
    expect(parseSince("2026-09-01T00:00:00.000Z")?.toISOString()).toBe(
      "2026-09-01T00:00:00.000Z",
    );
  });

  it("is null for absent or unparseable, so the function's week applies", () => {
    for (const bad of [null, undefined, "", "yesterday", "2026-13-45"]) {
      expect(parseSince(bad), String(bad)).toBeNull();
    }
  });
});

describe("parseInboxRow", () => {
  it("reads a row, awaiting_staff and all", () => {
    expect(
      parseInboxRow({
        id: 4,
        username: "bob_smith",
        kind: "bug",
        subject: "Logs",
        status: "open",
        created_at: new Date("2026-09-05T10:00:00.000Z"),
        updated_at: new Date("2026-09-05T11:00:00.000Z"),
        awaiting_staff: true,
      }),
    ).toEqual({
      id: 4,
      username: "bob_smith",
      kind: "bug",
      subject: "Logs",
      status: "open",
      createdAt: "2026-09-05T10:00:00.000Z",
      updatedAt: "2026-09-05T11:00:00.000Z",
      awaitingStaff: true,
    });
  });

  it("is null for a row with no id", () => {
    expect(parseInboxRow({})).toBeNull();
    expect(parseInboxRow(null)).toBeNull();
  });
});

describe("parseStaffThread", () => {
  it("reads the same shape as the player's view, plus the owner", () => {
    const thread = parseStaffThread([
      {
        ticket_id: 4,
        username: "bob_smith",
        ticket_kind: "bug",
        ticket_subject: "Logs",
        ticket_status: "open",
        ticket_created_at: new Date("2026-09-05T10:00:00.000Z"),
        ticket_updated_at: new Date("2026-09-05T11:00:00.000Z"),
        message_id: 1,
        from_staff: false,
        author: "bob_smith",
        body: "It crashed.",
        created_at: new Date("2026-09-05T10:00:00.000Z"),
      },
    ]);
    expect(thread?.username).toBe("bob_smith");
    expect(thread?.messages).toHaveLength(1);
  });

  it("is null when the actor is not staff, which returns no rows at all", () => {
    // `accounts.is_staff(p_actor)` is a WHERE clause in this function, so a
    // non-staff actor and a missing ticket are the same empty result.
    expect(parseStaffThread([])).toBeNull();
  });
});

describe("parseReportRow", () => {
  it("reads a row the login server wrote", () => {
    expect(
      parseReportRow({
        id: 1,
        reported_at: new Date("2026-09-05T10:00:00.000Z"),
        world: 1,
        reporter: "bob_smith",
        offender: "someone",
        reason: 6,
        coord: 52459126,
        session_uuid: "abc",
      }),
    ).toEqual({
      id: 1,
      reportedAt: "2026-09-05T10:00:00.000Z",
      world: 1,
      reporter: "bob_smith",
      offender: "someone",
      reason: 6,
      coord: 52459126,
      sessionUuid: "abc",
    });
  });

  it("keeps null for the two columns a pre-Part-3 row cannot have", () => {
    const row = parseReportRow({
      id: 2,
      reported_at: null,
      world: null,
      reporter: "",
      offender: "someone",
      reason: 0,
      coord: null,
      session_uuid: "",
    });
    expect(row?.world).toBeNull();
    expect(row?.coord).toBeNull();
    expect(row?.reporter).toBe("");
  });
});

describe("the result parsers", () => {
  it("accept exactly what staff_reply can return", () => {
    for (const result of [
      "ok",
      "forbidden",
      "not_found",
      "closed",
      "invalid",
    ]) {
      expect(parseStaffReplyResult(result)).toBe(result);
    }
  });

  it("accept exactly what staff_notice can return", () => {
    for (const result of [
      "ok",
      "forbidden",
      "bad_credentials",
      "rate_limited",
      "not_found",
      "invalid",
    ]) {
      expect(parseStaffNoticeResult(result)).toBe(result);
    }
  });

  it("know that staff_reply has no rate limit and staff_notice does", () => {
    // The password re-type is what makes staff_notice worth limiting, and it
    // rides accounts.throttled in a bucket of its own. staff_reply has no
    // re-type and no limit, so `rate_limited` from it would be a contract
    // break, not a busy moderator.
    expect(() => parseStaffReplyResult("rate_limited")).toThrow();
    expect(parseStaffNoticeResult("rate_limited")).toBe("rate_limited");
  });

  it("throw on anything else rather than guessing", () => {
    for (const bad of [null, undefined, "", "OK", "bad_credentials", 1, {}]) {
      expect(() => parseStaffReplyResult(bad)).toThrow(
        /accounts\.staff_reply returned/,
      );
    }
    for (const bad of [null, undefined, "", "closed", 1, {}]) {
      expect(() => parseStaffNoticeResult(bad)).toThrow(
        /accounts\.staff_notice returned/,
      );
    }
  });
});
