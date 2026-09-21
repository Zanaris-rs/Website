import type { NextRequest } from "next/server";

import { assertSameOrigin } from "@/lib/account/origin";
import { requireLiveSession } from "@/lib/account/session-server";
import { isConfigured, query } from "@/lib/db";
import { parseRecordAbandon, recordAbandonStatement, recordStatusFor } from "@/lib/records/queries";

/**
 * `POST /api/records/abandon` — give up the signed-in account's running
 * record. No body. It still counts against the account's starts: the cap is
 * on starting.
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
    console.warn("[records] refused: cross-origin abandon");
    return fail("origin", 403);
  }

  if (!isConfigured()) return fail("unavailable", 503);

  try {
    const statement = recordAbandonStatement(live.profile.username);
    const [row] = await query<{ result: unknown }>(statement.text, statement.values);
    const result = parseRecordAbandon(row?.result);

    if (result !== "ok") return fail(result, recordStatusFor(result));

    console.log("[records] abandoned");
    return Response.json({ ok: true }, { status: 200, headers: NO_STORE });
  } catch (error) {
    console.error("[records] abandon failed", error);
    return fail("unavailable", 503);
  }
}
