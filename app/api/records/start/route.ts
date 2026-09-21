import type { NextRequest } from "next/server";

import { assertSameOrigin } from "@/lib/account/origin";
import { requireLiveSession } from "@/lib/account/session-server";
import { isConfigured, query } from "@/lib/db";
import { DEFAULT_DURATION, recordDuration } from "@/lib/records/durations";
import { parseRecordStart, recordStartStatement, recordStatusFor } from "@/lib/records/queries";

/**
 * `POST /api/records/start` — start a record for the signed-in account.
 * Body `{ "duration": 300 }`, or none for the default.
 *
 * Everything that decides whether it starts - logged out and settled, one
 * running at a time, the cap, the snapshot itself - happens inside
 * `accounts.record_start`. The duration is checked here only to say something
 * specific; the database refuses one it does not run either way.
 */

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" } as const;

function fail(error: string, status: number): Response {
  return Response.json({ error }, { status, headers: NO_STORE });
}

export async function POST(request: NextRequest) {
  const live = await requireLiveSession();
  if (live.status !== "ok") {
    return fail(live.refusal.error, live.refusal.status);
  }

  if (!assertSameOrigin(request.headers)) {
    console.warn("[records] refused: cross-origin start");
    return fail("origin", 403);
  }

  const body = (await request.json().catch(() => null)) as { duration?: unknown } | null;
  const seconds = body?.duration ?? DEFAULT_DURATION.seconds;
  if (typeof seconds !== "number" || recordDuration(seconds) === null) {
    return fail("unknown_duration", 400);
  }

  if (!isConfigured()) return fail("unavailable", 503);

  try {
    const statement = recordStartStatement(live.profile.username, seconds);
    const rows = await query<Record<string, unknown>>(statement.text, statement.values);
    const result = parseRecordStart(rows[0]);

    if (result !== "ok") return fail(result, recordStatusFor(result));

    console.log("[records] started");
    return Response.json({ ok: true }, { status: 200, headers: NO_STORE });
  } catch (error) {
    console.error("[records] start failed", error);
    return fail("unavailable", 503);
  }
}
