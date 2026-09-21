import type { NextRequest } from "next/server";

import { assertSameOrigin } from "@/lib/account/origin";
import { requireLiveSession } from "@/lib/account/session-server";
import { isConfigured, query } from "@/lib/db";
import { parseRecordStop, recordStatusFor, recordStopStatement } from "@/lib/records/queries";

/**
 * `POST /api/records/stop` — close the signed-in account's running record.
 * No body.
 *
 * `accounts.record_stop` refuses while the player is in the game or has only
 * just left it, and otherwise decides the verdict: the window is Start to the
 * final logout, so when this is pressed does not change the result.
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
    console.warn("[records] refused: cross-origin stop");
    return fail("origin", 403);
  }

  if (!isConfigured()) return fail("unavailable", 503);

  try {
    const statement = recordStopStatement(live.profile.username);
    const rows = await query<Record<string, unknown>>(statement.text, statement.values);
    const stopped = parseRecordStop(rows[0]);

    if (stopped.result !== "ok") return fail(stopped.result, recordStatusFor(stopped.result));

    console.log(`[records] stopped: ${stopped.state}${stopped.reason ? `/${stopped.reason}` : ""}`);
    return Response.json(
      { ok: true, state: stopped.state, reason: stopped.reason },
      { status: 200, headers: NO_STORE },
    );
  } catch (error) {
    console.error("[records] stop failed", error);
    return fail("unavailable", 503);
  }
}
