import { describe, expect, it } from "vitest";

import {
  messageStatement,
  messagesStatement,
  parseMessageDetail,
  parseMessageSummary,
  parseThread,
  parseTicketOpenResult,
  parseTicketReplyResult,
  parseTicketSummary,
  parseUnread,
  statusFor,
  ticketOpenStatement,
  ticketReplyStatement,
  ticketThreadStatement,
  ticketsStatement,
  unreadStatement,
} from "./queries";

/**
 * The SQL text is asserted character for character, for the same reason
 * `lib/account/login.test.ts` does it: these statements are the entire list of
 * verbs a leaked `DATABASE_URL` can perform against the Message Centre. A
 * stray edit that interpolated a username would be a live injection, and one
 * that dropped a parameter and shifted the rest along would call
 * `accounts.message(id, username)` — a passing suite either way, unless the
 * text itself is what is being checked.
 */
describe("the statements", () => {
  it("asks for the unread count by name", () => {
    expect(unreadStatement("bob_smith")).toEqual({
      text: "select accounts.unread($1) as unread",
      values: ["bob_smith"],
    });
  });

  it("lists messages and tickets by name", () => {
    expect(messagesStatement("bob_smith")).toEqual({
      text: "select * from accounts.messages($1)",
      values: ["bob_smith"],
    });
    expect(ticketsStatement("bob_smith")).toEqual({
      text: "select * from accounts.tickets($1)",
      values: ["bob_smith"],
    });
  });

  it("opens one message with the name first and the id second", () => {
    // The order is the authorisation: the function resolves $1 to an account
    // id and requires the message to belong to it. Swapped, it would look up
    // an account called "12".
    expect(messageStatement("bob_smith", 12)).toEqual({
      text: "select * from accounts.message($1, $2)",
      values: ["bob_smith", 12],
    });
    expect(ticketThreadStatement("bob_smith", 12)).toEqual({
      text: "select * from accounts.ticket_thread($1, $2)",
      values: ["bob_smith", 12],
    });
  });

  it("opens a ticket with kind, subject and body in that order", () => {
    expect(ticketOpenStatement("bob_smith", "bug", "Subject", "Body")).toEqual({
      text: "select accounts.ticket_open($1, $2, $3, $4) as result",
      values: ["bob_smith", "bug", "Subject", "Body"],
    });
  });

  it("replies to a ticket with the id before the body", () => {
    expect(ticketReplyStatement("bob_smith", 12, "Body")).toEqual({
      text: "select accounts.ticket_reply($1, $2, $3) as result",
      values: ["bob_smith", 12, "Body"],
    });
  });

  it("never interpolates: every value is a placeholder", () => {
    const nasty = "'; drop table account_message; --";
    for (const statement of [
      unreadStatement(nasty),
      messagesStatement(nasty),
      messageStatement(nasty, 1),
      ticketsStatement(nasty),
      ticketThreadStatement(nasty, 1),
      ticketOpenStatement(nasty, nasty, nasty, nasty),
      ticketReplyStatement(nasty, 1, nasty),
    ]) {
      expect(statement.text).not.toContain(nasty);
      expect(statement.text).not.toContain("drop table");
      expect(statement.values).toContain(nasty);
    }
  });

  it("passes no `name`, so the transaction pooler never sees a prepare", () => {
    for (const statement of [
      unreadStatement("a"),
      messagesStatement("a"),
      messageStatement("a", 1),
      ticketsStatement("a"),
      ticketThreadStatement("a", 1),
      ticketOpenStatement("a", "bug", "b", "c"),
      ticketReplyStatement("a", 1, "b"),
    ]) {
      expect(Object.keys(statement).sort()).toEqual(["text", "values"]);
    }
  });
});

describe("parseUnread", () => {
  it("takes the count", () => {
    expect(parseUnread(0)).toBe(0);
    expect(parseUnread(7)).toBe(7);
  });

  it("is 0 for anything it cannot read, rather than an error", () => {
    // This number decorates a link. A page that 503s because a decoration is
    // unreadable is a worse page than one whose link says nothing.
    for (const bad of [null, undefined, "3", NaN, -1, {}]) {
      expect(parseUnread(bad)).toBe(0);
    }
  });
});

describe("parseMessageSummary", () => {
  const row = {
    id: 3,
    ticket_id: null,
    kind: "welcome",
    subject: "Welcome to Zanaris",
    created_at: new Date("2026-09-05T10:00:00.000Z"),
    read_at: null,
    preview: "Welcome to Zanaris.",
  };

  it("reads a row as the list needs it", () => {
    expect(parseMessageSummary(row)).toEqual({
      id: 3,
      ticketId: null,
      kind: "welcome",
      subject: "Welcome to Zanaris",
      createdAt: "2026-09-05T10:00:00.000Z",
      readAt: null,
      preview: "Welcome to Zanaris.",
    });
  });

  it("keeps a ticket id when there is one", () => {
    expect(parseMessageSummary({ ...row, ticket_id: 9 })?.ticketId).toBe(9);
  });

  it("is null for a row with no id, rather than a blank line in the list", () => {
    expect(parseMessageSummary({ ...row, id: undefined })).toBeNull();
    expect(parseMessageSummary(null)).toBeNull();
    expect(parseMessageSummary("nope")).toBeNull();
  });

  it("turns an unreadable date into null, not Invalid Date", () => {
    expect(parseMessageSummary({ ...row, created_at: "nonsense" })?.createdAt)
      .toBeNull();
  });
});

describe("parseMessageDetail", () => {
  it("carries the body, and uses it as the preview", () => {
    // `accounts.message` has no preview column: it returns the whole body.
    const detail = parseMessageDetail({
      id: 3,
      ticket_id: null,
      kind: "notice",
      subject: "A notice",
      body: "The whole body.",
      created_at: new Date("2026-09-05T10:00:00.000Z"),
      read_at: null,
    });
    expect(detail?.body).toBe("The whole body.");
    expect(detail?.preview).toBe("The whole body.");
  });
});

describe("parseTicketSummary", () => {
  it("reads a row, unread count and all", () => {
    expect(
      parseTicketSummary({
        id: 4,
        kind: "bug",
        subject: "Logs",
        status: "open",
        created_at: new Date("2026-09-05T10:00:00.000Z"),
        updated_at: new Date("2026-09-05T11:00:00.000Z"),
        unread: 2,
      }),
    ).toEqual({
      id: 4,
      kind: "bug",
      subject: "Logs",
      status: "open",
      createdAt: "2026-09-05T10:00:00.000Z",
      updatedAt: "2026-09-05T11:00:00.000Z",
      unread: 2,
    });
  });
});

describe("parseThread", () => {
  const header = {
    ticket_id: 4,
    ticket_kind: "bug",
    ticket_subject: "Logs",
    ticket_status: "open",
    ticket_created_at: new Date("2026-09-05T10:00:00.000Z"),
    ticket_updated_at: new Date("2026-09-05T11:00:00.000Z"),
  };

  it("reads the header off the first row and the messages off all of them", () => {
    const thread = parseThread([
      {
        ...header,
        message_id: 1,
        from_staff: false,
        author: "bob_smith",
        body: "It crashed.",
        created_at: new Date("2026-09-05T10:00:00.000Z"),
      },
      {
        ...header,
        message_id: 2,
        from_staff: true,
        author: "admin",
        body: "Looking into it.",
        created_at: new Date("2026-09-05T11:00:00.000Z"),
      },
    ]);

    expect(thread?.id).toBe(4);
    expect(thread?.subject).toBe("Logs");
    expect(thread?.messages).toHaveLength(2);
    expect(thread?.messages[1]).toEqual({
      id: 2,
      fromStaff: true,
      author: "admin",
      body: "Looking into it.",
      createdAt: "2026-09-05T11:00:00.000Z",
    });
  });

  it("is null when there are no rows: no such ticket, or not this caller's", () => {
    // The function returns nothing in both cases, deliberately, so that a
    // ticket id cannot be probed for existence. The route answers 404 either
    // way.
    expect(parseThread([])).toBeNull();
  });

  it("renders a header with no messages when the LEFT JOIN matched nothing", () => {
    const thread = parseThread([{ ...header, message_id: null }]);
    expect(thread?.id).toBe(4);
    expect(thread?.messages).toEqual([]);
  });

  it("keeps the owner's name when the staff view supplies one", () => {
    expect(parseThread([{ ...header, username: "bob_smith" }])?.username).toBe(
      "bob_smith",
    );
    expect(parseThread([header])?.username).toBeNull();
  });
});

describe("the result parsers", () => {
  it("accept exactly what the functions can return", () => {
    for (const result of ["ok", "rate_limited", "invalid"]) {
      expect(parseTicketOpenResult(result)).toBe(result);
    }
    for (const result of [
      "ok",
      "not_found",
      "closed",
      "rate_limited",
      "invalid",
    ]) {
      expect(parseTicketReplyResult(result)).toBe(result);
    }
  });

  it("throw on anything else rather than guessing", () => {
    for (const bad of [null, undefined, "", "OK", "closed", 1, {}]) {
      expect(() => parseTicketOpenResult(bad)).toThrow(
        /accounts\.ticket_open returned/,
      );
    }
    for (const bad of [null, undefined, "", "forbidden", 1, {}]) {
      expect(() => parseTicketReplyResult(bad)).toThrow(
        /accounts\.ticket_reply returned/,
      );
    }
  });
});

describe("statusFor", () => {
  it("maps every result string the whole SQL API can produce", () => {
    expect(statusFor("ok")).toBe(200);
    expect(statusFor("invalid")).toBe(400);
    expect(statusFor("forbidden")).toBe(403);
    // Not 401: the caller *is* signed in, and it is the re-typed password that
    // was wrong.
    expect(statusFor("bad_credentials")).toBe(403);
    expect(statusFor("not_found")).toBe(404);
    // A conflict with the ticket's state, not a malformed request.
    expect(statusFor("closed")).toBe(409);
    expect(statusFor("rate_limited")).toBe(429);
  });

  it("is a 500 for a string with no mapping", () => {
    expect(statusFor("something_new")).toBe(500);
  });
});
