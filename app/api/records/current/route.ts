import { requireLiveSession } from "@/lib/account/session-server";
import { isConfigured, query } from "@/lib/db";
import type { RecordCurrentResponse } from "@/lib/records/api";
import { parseRecordCurrent, recordCurrentStatement } from "@/lib/records/queries";

/**
 * `GET /api/records/current` — where the signed-in player is, and their
 * newest record attempt. The account page polls this every few seconds while
 * it is visible, to show "logged in" / "logged out" and to keep the timer on
 * the database's clock.
 *
 * It writes nothing, so it needs the live session (the answer is private) but
 * not the same-origin-fetch guard the two GETs that write carry: a cross-site
 * page cannot read the response.
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
    const statement = recordCurrentStatement(live.profile.username);
    const rows = await query<Record<string, unknown>>(statement.text, statement.values);
    const current: RecordCurrentResponse = parseRecordCurrent(rows);
    return Response.json(current, { status: 200, headers: NO_STORE });
  } catch (error) {
    console.error("[records] current failed", error);
    return fail("unavailable", 503);
  }
}
