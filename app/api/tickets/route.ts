import type { NextRequest } from "next/server";

import { assertSameOrigin } from "@/lib/account/origin";
import { requireLiveSession } from "@/lib/account/session-server";
import {
  isTicketKind,
  validateBody,
  validateSubject,
} from "@/lib/messages/format";
import {
  type TicketSummary,
  parseTicketOpenResult,
  parseTicketSummary,
  statusFor,
  ticketOpenStatement,
  ticketsStatement,
} from "@/lib/messages/queries";
import { isConfigured, query } from "@/lib/db";

/**
 * `GET /api/tickets` — the signed-in account's tickets, newest activity first,
 * each with its own count of unread staff replies.
 *
 * `POST /api/tickets` — open one. `{ kind, subject, body }`.
 *
 * The caps are checked twice on purpose. `accounts.ticket_open` refuses a
 * subject over 120 characters, a body over 4000, a kind outside the three, and
 * a sixth ticket in a day — it is the authority, and it would refuse all of
 * those if this route validated nothing. What the checks here add is a
 * *sentence*: `invalid` from the database cannot say which field was wrong,
 * and "Give the message a subject." is the difference between a form somebody
 * can fix and one that just says 400. Every number comes from the contract
 * fixture, so the two can only disagree if the fixture and the migration do.
 *
 * The one thing this side cannot pre-empt is the daily cap, because only the
 * database knows how many tickets today has had. `rate_limited` comes back as
 * a 429 with the number in the message.
 *
 * Both handlers check the cookie against the database (`requireLiveSession`),
 * so a password changed on another device revokes this one before either the
 * list or the open runs.
 */

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" } as const;

function fail(error: string, status: number): Response {
  return Response.json({ error }, { status, headers: NO_STORE });
}

export async function GET() {
  const live = await requireLiveSession();
  if (live.status !== "ok") {
    return fail(live.refusal.error, live.refusal.status);
  }

  if (!isConfigured()) return fail("unavailable", 503);

  try {
    const statement = ticketsStatement(live.profile.username);
    const rows = await query<Record<string, unknown>>(
      statement.text,
      statement.values,
    );
    const tickets = rows
      .map(parseTicketSummary)
      .filter((ticket): ticket is TicketSummary => ticket !== null);

    return Response.json({ tickets }, { status: 200, headers: NO_STORE });
  } catch (error) {
    console.error("[tickets] list failed", error);
    return fail("unavailable", 503);
  }
}

type Body = { kind?: unknown; subject?: unknown; body?: unknown };

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export async function POST(request: NextRequest) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return fail("bad_request", 400);
  }

  const live = await requireLiveSession();
  if (live.status !== "ok") {
    return fail(live.refusal.error, live.refusal.status);
  }

  if (!assertSameOrigin(request.headers)) {
    console.warn("[tickets] refused: cross-origin POST");
    return fail("origin", 403);
  }

  if (!isTicketKind(body.kind)) return fail("kind_invalid", 400);

  const subject = validateSubject(asString(body.subject));
  if (!subject.ok) return fail(subject.error, 400);

  const text = validateBody(asString(body.body));
  if (!text.ok) return fail(text.error, 400);

  if (!isConfigured()) return fail("unavailable", 503);

  try {
    const statement = ticketOpenStatement(
      live.profile.username,
      body.kind,
      subject.value,
      text.value,
    );
    const rows = await query<{ result: unknown }>(
      statement.text,
      statement.values,
    );
    const result = parseTicketOpenResult(rows[0]?.result);

    if (result !== "ok") {
      console.warn(`[tickets] open ${result}`);
      return fail(result, statusFor(result));
    }

    console.log("[tickets] opened");
    return Response.json({ ok: true }, { status: 200, headers: NO_STORE });
  } catch (error) {
    console.error("[tickets] open failed", error);
    return fail("unavailable", 503);
  }
}
