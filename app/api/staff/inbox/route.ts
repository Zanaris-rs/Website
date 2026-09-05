import type { NextRequest } from "next/server";

import { readSession } from "@/lib/account/session-server";
import {
  type InboxRow,
  parseInboxRow,
  parseInboxStatus,
  staffInboxStatement,
} from "@/lib/staff/queries";
import { loadStaff } from "@/lib/staff/staff-server";
import { isConfigured, query } from "@/lib/db";

/**
 * `GET /api/staff/inbox?status=open|closed|all` — the ticket queue.
 *
 * Two locks, and both are load-bearing:
 *
 *  1. `loadStaff` re-reads `staffmodlevel` from `accounts.profile` on this
 *     request. The cookie never carries it, so a forged cookie cannot promote
 *     anybody and a demoted moderator loses this on their next request.
 *  2. `accounts.staff_inbox` calls `accounts.is_staff(p_actor)` in its own
 *     `WHERE` clause, so even a route that skipped (1) would return an empty
 *     list rather than the queue.
 *
 * `?status=` is parsed rather than passed through. The function's third state
 * is `'all'` and anything else matches no row — a typo in the query string
 * would empty the inbox and read as a quiet day, so an unrecognised value
 * falls back to `open`.
 */

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" } as const;

function fail(error: string, status: number): Response {
  return Response.json({ error }, { status, headers: NO_STORE });
}

export async function GET(request: NextRequest) {
  const session = await readSession();
  if (!session) return fail("session_expired", 401);

  const staff = await loadStaff(session);
  if (staff.status === "unavailable") return fail("unavailable", 503);
  if (staff.status === "signed_out") return fail("session_expired", 401);
  if (staff.status === "forbidden") return fail("forbidden", 403);

  const status = parseInboxStatus(
    request.nextUrl.searchParams.get("status") ?? undefined,
  );

  if (!isConfigured()) return fail("unavailable", 503);

  try {
    const statement = staffInboxStatement(staff.profile.username, status);
    const rows = await query<Record<string, unknown>>(
      statement.text,
      statement.values,
    );
    const tickets = rows
      .map(parseInboxRow)
      .filter((ticket): ticket is InboxRow => ticket !== null);

    return Response.json(
      { status, tickets },
      { status: 200, headers: NO_STORE },
    );
  } catch (error) {
    console.error("[staff] inbox failed", error);
    return fail("unavailable", 503);
  }
}
