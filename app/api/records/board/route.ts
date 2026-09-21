import type { NextRequest } from "next/server";

import { isConfigured, query } from "@/lib/db";
import { displayName } from "@/lib/hiscores/format";
import { BOARD_CACHE_CONTROL, parseBoardParams, toBoardResponse } from "@/lib/records/api";
import { parseRecordBoardRow, recordBoardStatement } from "@/lib/records/queries";

/**
 * `GET /api/records/board?category=N[&duration=S]` — one public record board:
 * each player's best valid attempt for a duration and a hiscore category.
 *
 * Shaped like `/api/hiscores`: parse, 400 on a bad parameter, 503 when the
 * database is not there, and the hiscores' own cache policy otherwise. What is
 * public - valid attempts only, no staff, no bans - is decided by
 * `accounts.record_board`, not here.
 */

export async function GET(request: NextRequest) {
  const parsed = parseBoardParams(request.nextUrl.searchParams);
  if (!parsed.ok) {
    return Response.json(
      { error: parsed.error },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (!isConfigured()) {
    return Response.json(
      { error: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const statement = recordBoardStatement(parsed.value.durationSeconds, parsed.value.category);
    const rows = await query<Record<string, unknown>>(statement.text, statement.values);
    return Response.json(
      toBoardResponse(parsed.value, rows.map(parseRecordBoardRow), displayName),
      { headers: { "Cache-Control": BOARD_CACHE_CONTROL } },
    );
  } catch (error) {
    console.error("[records] board query failed", error);
    return Response.json(
      { error: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
