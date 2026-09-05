import { describe, expect, it } from "vitest";

import {
  BODY_MAX,
  MESSAGE_KINDS,
  NOTICES_PER_HOUR,
  NOTICE_KIND,
  REPLIES_PER_HOUR,
  SUBJECT_MAX,
  TICKETS_PER_DAY,
  TICKET_KINDS,
  TICKET_STATUSES,
} from "@/lib/messages/format";

import contract from "./message-centre-contract.json";

/**
 * The Message Centre contract, pinned.
 *
 * `message-centre-contract.json` is a **byte-for-byte copy** of the engine's
 * `test/fixtures/message-centre-contract.json`. Three implementations of one
 * rule hang off it and none of them can see the other two at runtime:
 *
 * - the engine's login server counts `unread_sql` over Kysely and puts the
 *   number on the client's welcome screen;
 * - `accounts.unread()` in `3_message_centre/migration.sql` counts the same
 *   thing after resolving a username to an id;
 * - this site counts it for the inbox and the Account Centre link.
 *
 * If they drift, the player sees a number in game that the site cannot
 * explain, and **nothing anywhere throws**. There is no test that can span the
 * three at once, so this file does the next best thing: it writes the values
 * out by hand and compares. Re-copying the fixture from the engine is then a
 * change that fails here rather than one that ships quietly, and whoever
 * re-copies it has to decide, deliberately, what the new number means for the
 * pages and the SQL.
 *
 * The second half checks the other direction: that `lib/messages/format.ts`
 * really does *read* the fixture rather than repeating it. A cap typed in by
 * hand is the exact bug this arrangement exists to prevent.
 */

describe("the fixture, spelled out", () => {
  it("carries the one unread rule verbatim", () => {
    // Whitespace and all: this fragment is quoted in the migration's header
    // comment and in the engine's MessageCentre.ts, and a reformatted copy is
    // a copy somebody has edited.
    expect(contract.unread_sql).toBe(
      "count(*) from account_message where account_id = $1 and read_at is null",
    );
  });

  it("names the five message kinds, in order", () => {
    expect(contract.kinds).toEqual([
      "welcome",
      "notice",
      "ban",
      "mute",
      "reply",
    ]);
  });

  it("names every column of account_message, in table order", () => {
    expect(contract.account_message_columns).toEqual([
      "id",
      "account_id",
      "ticket_id",
      "kind",
      "subject",
      "body",
      "created_by_account_id",
      "created_at",
      "read_at",
    ]);
  });

  it("names the ticket kinds and statuses", () => {
    expect(contract.ticket_kinds).toEqual(["bug", "appeal", "other"]);
    expect(contract.ticket_statuses).toEqual(["open", "closed"]);
  });

  it("carries the caps the SQL enforces", () => {
    expect(contract.limits).toEqual({
      subject: 120,
      body: 4000,
      // The engine clamps the welcome screen's count to a `p2`; the site never
      // sends this number anywhere, but it is part of the same contract and a
      // change to it is a change the site should notice.
      message_count: 65535,
      tickets_per_account_per_day: 5,
      ticket_replies_per_account_per_hour: 20,
      staff_notices_per_actor_per_hour: 20,
    });
  });
});

describe("what the site derives from it", () => {
  it("takes the caps from the fixture, not from a literal", () => {
    expect(SUBJECT_MAX).toBe(contract.limits.subject);
    expect(BODY_MAX).toBe(contract.limits.body);
    expect(TICKETS_PER_DAY).toBe(contract.limits.tickets_per_account_per_day);
    expect(REPLIES_PER_HOUR).toBe(
      contract.limits.ticket_replies_per_account_per_hour,
    );
    expect(NOTICES_PER_HOUR).toBe(
      contract.limits.staff_notices_per_actor_per_hour,
    );
  });

  it("knows exactly the kinds the fixture knows", () => {
    expect([...MESSAGE_KINDS]).toEqual(contract.kinds);
    expect([...TICKET_KINDS]).toEqual(contract.ticket_kinds);
    expect([...TICKET_STATUSES]).toEqual(contract.ticket_statuses);
  });

  it("writes notices under a kind the contract lists", () => {
    // `accounts.staff_notice` hard-codes 'notice'; a NOTICE_KIND that drifted
    // would only show up as a message the list rendered as "Message".
    expect(contract.kinds).toContain(NOTICE_KIND);
    expect(NOTICE_KIND).toBe("notice");
  });
});
