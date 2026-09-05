import { describe, expect, it } from "vitest";

import {
  DEFAULT_INBOX_STATUS,
  RESOLUTIONS,
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
  parseChatRow,
  parseInputChunkRow,
  parseReportDetail,
  parseResolution,
  parseStaffLiftResult,
  parseStaffPunishmentNoteResult,
  parseStaffResolveResult,
  parseWealthRow,
  staffLiftStatement,
  staffPunishmentNoteStatement,
  staffReportChatStatement,
  staffReportInputStatement,
  staffReportResolveStatement,
  staffReportStatement,
  staffReportWealthStatement,
  staffReportsStatement,
  staffThreadStatement,
  staffWealthStatement,
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
      uuid: "",
      hasEvidence: false,
      resolution: null,
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

/**
 * The evidence half. These statements are written against
 * `4_evidence_and_records`, which is applied after this branch was written, so
 * asserting the text character for character is the whole of what this side
 * can prove: an argument in the wrong order is a hash handed to a function as
 * a report id, and no type checker on either side of the wire would notice.
 */
describe("the evidence statements", () => {
  it("read one report and its four kinds of evidence by actor and id", () => {
    expect(staffReportStatement("admin", 7)).toEqual({
      text: "select * from accounts.staff_report($1, $2)",
      values: ["admin", 7],
    });
    expect(staffReportInputStatement("admin", 7)).toEqual({
      text: "select * from accounts.staff_report_input($1, $2)",
      values: ["admin", 7],
    });
    expect(staffReportChatStatement("admin", 7)).toEqual({
      text: "select * from accounts.staff_report_chat($1, $2)",
      values: ["admin", 7],
    });
    expect(staffReportWealthStatement("admin", 7)).toEqual({
      text: "select * from accounts.staff_report_wealth($1, $2)",
      values: ["admin", 7],
    });
  });

  it("searches wealth by name with a since that may be null", () => {
    expect(staffWealthStatement("admin", "bob_smith")).toEqual({
      text: "select * from accounts.staff_wealth($1, $2, $3)",
      values: ["admin", "bob_smith", null],
    });
    const since = new Date("2026-09-01T00:00:00.000Z");
    expect(staffWealthStatement("admin", "bob_smith", since).values[2]).toBe(
      since,
    );
  });

  it("puts the candidate hash second in both verbs that re-type a password", () => {
    // Second, exactly as staff_notice does. `dismissed` deletes a macroer's
    // mouse trail and `staff_lift` un-bans an account: both are the sort of
    // thing a stolen session must not be able to do on its own.
    expect(
      staffReportResolveStatement("admin", "$2b$10$hash", 7, "dismissed", "n"),
    ).toEqual({
      text: "select accounts.staff_report_resolve($1, $2, $3, $4, $5) as result",
      values: ["admin", "$2b$10$hash", 7, "dismissed", "n"],
    });
    expect(staffLiftStatement("admin", "$2b$10$hash", 12, "note")).toEqual({
      text: "select accounts.staff_lift($1, $2, $3, $4) as result",
      values: ["admin", "$2b$10$hash", 12, "note"],
    });
  });

  it("writes a public note without one, because it grants nothing", () => {
    expect(staffPunishmentNoteStatement("admin", 12, "Bot farm.")).toEqual({
      text: "select accounts.staff_punishment_note($1, $2, $3) as result",
      values: ["admin", 12, "Bot farm."],
    });
  });

  it("never interpolates, and never names a statement", () => {
    const nasty = "'; drop table report_input; --";
    for (const statement of [
      staffReportStatement(nasty, 1),
      staffReportInputStatement(nasty, 1),
      staffReportChatStatement(nasty, 1),
      staffReportWealthStatement(nasty, 1),
      staffWealthStatement(nasty, nasty),
      staffReportResolveStatement(nasty, nasty, 1, "watch", nasty),
      staffLiftStatement(nasty, nasty, 1, nasty),
      staffPunishmentNoteStatement(nasty, 1, nasty),
    ]) {
      expect(statement.text).not.toContain(nasty);
      expect(statement.text).not.toContain("drop table");
      expect(statement.values).toContain(nasty);
      expect(Object.keys(statement).sort()).toEqual(["text", "values"]);
    }
  });
});

describe("parseResolution", () => {
  it("takes the three the column may hold", () => {
    for (const resolution of RESOLUTIONS) {
      expect(parseResolution(resolution)).toBe(resolution);
    }
  });

  it("reads anything else as an open report rather than guessing", () => {
    // A resolution a later migration adds must not show as a resolution this
    // build cannot act on: "open" is the safe reading, because an open report
    // is one a moderator looks at again.
    for (const bad of [null, undefined, "", "ACTIONED", "escalated", 1, {}]) {
      expect(parseResolution(bad)).toBeNull();
    }
  });
});

describe("parseReportRow, with the three columns migration 4 adds", () => {
  it("carries the uuid, the evidence flag and the resolution", () => {
    const row = parseReportRow({
      id: 4,
      reported_at: new Date("2026-09-05T12:33:11.000Z"),
      world: 1,
      reporter: "mod_matt",
      offender: "bob_smith",
      reason: 5,
      coord: 50331648,
      session_uuid: "s-1",
      uuid: "dcfcdaf6",
      has_evidence: true,
      resolution: "watch",
    });
    expect(row?.uuid).toBe("dcfcdaf6");
    expect(row?.hasEvidence).toBe(true);
    expect(row?.resolution).toBe("watch");
  });

  it("reads a row written before migration 4 as evidence-free and open", () => {
    const row = parseReportRow({
      id: 1,
      reported_at: null,
      world: null,
      reporter: "",
      offender: "bob_smith",
      reason: null,
      coord: null,
      session_uuid: "s-1",
    });
    expect(row?.uuid).toBe("");
    expect(row?.hasEvidence).toBe(false);
    expect(row?.resolution).toBeNull();
  });
});

describe("parseReportDetail", () => {
  const full = {
    id: 4,
    uuid: "dcfcdaf6",
    reported_at: new Date("2026-09-05T12:33:11.000Z"),
    world: 1,
    reporter: "mod_matt",
    offender: "bob_smith",
    reason: 5,
    coord: 50331648,
    session_uuid: "s-1",
    offender_registered: true,
    offender_banned_until: new Date("2026-09-12T12:00:00.000Z"),
    offender_muted_until: null,
    offender_world: 1,
    window_from: new Date("2026-09-05T12:03:11.000Z"),
    window_to: new Date("2026-09-05T12:48:11.000Z"),
    input_chunks: 4,
    same_ip_as_reporter: false,
    offender_logins_24h: 3,
    resolved_at: null,
    resolution: null,
    resolved_by: "",
    staff_note: "",
    ban_punishment_id: 12,
    mute_punishment_id: null,
  };

  it("reads the whole row, dates as ISO strings", () => {
    const detail = parseReportDetail(full);
    expect(detail?.id).toBe(4);
    expect(detail?.uuid).toBe("dcfcdaf6");
    expect(detail?.reportedAt).toBe("2026-09-05T12:33:11.000Z");
    expect(detail?.windowFrom).toBe("2026-09-05T12:03:11.000Z");
    expect(detail?.windowTo).toBe("2026-09-05T12:48:11.000Z");
    expect(detail?.inputChunks).toBe(4);
    expect(detail?.offenderRegistered).toBe(true);
    expect(detail?.offenderBannedUntil).toBe("2026-09-12T12:00:00.000Z");
    expect(detail?.banPunishmentId).toBe(12);
    expect(detail?.mutePunishmentId).toBeNull();
  });

  it("keeps 'no login to compare' apart from 'a different address'", () => {
    // Three states, and the middle one matters: false means the function
    // compared two addresses and they differed, null means it had nothing to
    // compare. Collapsing them would put "not the same person" on a page where
    // the truth is "we do not know".
    expect(parseReportDetail(full)?.sameIpAsReporter).toBe(false);
    expect(
      parseReportDetail({ ...full, same_ip_as_reporter: true })
        ?.sameIpAsReporter,
    ).toBe(true);
    expect(
      parseReportDetail({ ...full, same_ip_as_reporter: null })
        ?.sameIpAsReporter,
    ).toBeNull();
  });

  it("refuses a row with no id rather than rendering an empty page", () => {
    expect(parseReportDetail(null)).toBeNull();
    expect(parseReportDetail({})).toBeNull();
    expect(parseReportDetail({ id: "4" })).toBeNull();
  });
});

describe("the evidence row parsers", () => {
  it("reads an input chunk, base64 left as text", () => {
    const chunk = parseInputChunkRow({
      seq: 0,
      kind: "ring",
      client: "web",
      started_at: new Date("2026-09-05T12:33:03.000Z"),
      flushed_at: new Date("2026-09-05T12:33:05.000Z"),
      data_base64: "BgMFAAAC",
    });
    expect(chunk).toEqual({
      seq: 0,
      kind: "ring",
      client: "web",
      startedAt: "2026-09-05T12:33:03.000Z",
      flushedAt: "2026-09-05T12:33:05.000Z",
      data: "BgMFAAAC",
    });
    // seq 0 is a real chunk, not a missing one.
    expect(parseInputChunkRow({ seq: 0 })?.seq).toBe(0);
    expect(parseInputChunkRow({ kind: "ring" })).toBeNull();
  });

  it("reads a chat line, and a public one has no recipient", () => {
    expect(
      parseChatRow({
        at: new Date("2026-09-05T12:21:41.000Z"),
        kind: "public",
        to_username: null,
        coord: 50331648,
        message: "inside the before window",
      }),
    ).toEqual({
      at: "2026-09-05T12:21:41.000Z",
      kind: "public",
      toUsername: "",
      coord: 50331648,
      message: "inside the before window",
    });
    expect(parseChatRow({ kind: "public" })).toBeNull();
  });

  it("passes an item list through as the engine's own JSON", () => {
    const wealth = parseWealthRow({
      at: new Date("2026-09-05T12:20:00.000Z"),
      event_type: 0,
      coord: 50331648,
      items: '[{"id":995,"name":"Coins","count":1000}]',
      value: 1000,
      counterpart: "s-2",
      counterpart_items: "[]",
      counterpart_value: 0,
    });
    expect(wealth?.eventType).toBe(0);
    expect(wealth?.items).toBe('[{"id":995,"name":"Coins","count":1000}]');
    expect(wealth?.counterpart).toBe("s-2");
    expect(parseWealthRow({ event_type: 0 })).toBeNull();
  });
});

describe("the evidence result parsers", () => {
  it("accept what the two password verbs can return", () => {
    for (const result of [
      "ok",
      "forbidden",
      "bad_credentials",
      "rate_limited",
      "not_found",
      "invalid",
    ]) {
      expect(parseStaffResolveResult(result)).toBe(result);
      expect(parseStaffLiftResult(result)).toBe(result);
    }
  });

  it("know the note has no password and so no bad_credentials", () => {
    for (const result of [
      "ok",
      "forbidden",
      "rate_limited",
      "not_found",
      "invalid",
    ]) {
      expect(parseStaffPunishmentNoteResult(result)).toBe(result);
    }
    // It takes no password, so there is nothing to mistype — but it is limited
    // all the same, at twenty an hour, because the thing it writes is a line
    // on a page anybody can read.
    expect(() => parseStaffPunishmentNoteResult("bad_credentials")).toThrow(
      /accounts\.staff_punishment_note returned/,
    );
  });

  it("throw on anything else, naming the function that said it", () => {
    expect(() => parseStaffResolveResult("dismissed")).toThrow(
      /accounts\.staff_report_resolve returned/,
    );
    expect(() => parseStaffLiftResult(null)).toThrow(
      /accounts\.staff_lift returned/,
    );
    expect(() => parseStaffPunishmentNoteResult(1)).toThrow(
      /accounts\.staff_punishment_note returned/,
    );
  });
});
