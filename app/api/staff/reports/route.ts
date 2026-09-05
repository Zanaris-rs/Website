import type { NextRequest } from "next/server";

import { readSession } from "@/lib/account/session-server";
import {
  type ReportRow,
  parseReportRow,
  parseSince,
  staffReportsStatement,
} from "@/lib/staff/queries";
import { loadStaff } from "@/lib/staff/staff-server";
import { isConfigured, query } from "@/lib/db";

/**
 * `GET /api/staff/reports?since=<ISO 8601>` — Report Abuse rows, newest first,
 * with both usernames resolved.
 *
 * These rows only exist from Part 3 onwards. Report Abuse used to be posted to
 * the logger thread, and the logger server is disabled on this fleet, so every
 * report was dropped while the player was told it had been received. The login
 * server writes them now, and it knows who pressed the button and on which
 * world — which is why `reporter_account_id` and `world` are nullable and why
 * anything older reads as "unknown" on the page.
 *
 * `since` is optional and passed as NULL when absent, letting the function
 * pick its own default of a week. A `since` that is not a date is treated as
 * absent rather than refused: this is a staff tool with a text box, and an
 * unparseable date should show the default week, not a 400.
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

  const since = parseSince(request.nextUrl.searchParams.get("since"));

  if (!isConfigured()) return fail("unavailable", 503);

  try {
    const statement = staffReportsStatement(staff.profile.username, since);
    const rows = await query<Record<string, unknown>>(
      statement.text,
      statement.values,
    );
    const reports = rows
      .map(parseReportRow)
      .filter((report): report is ReportRow => report !== null);

    return Response.json({ reports }, { status: 200, headers: NO_STORE });
  } catch (error) {
    console.error("[staff] reports failed", error);
    return fail("unavailable", 503);
  }
}
