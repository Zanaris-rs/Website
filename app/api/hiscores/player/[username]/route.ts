import type { NextRequest } from "next/server";

import { isConfigured, query } from "@/lib/db";
import { HISCORES_CACHE_CONTROL, toPlayerResponse } from "@/lib/hiscores/api";
import { displayName } from "@/lib/hiscores/format";
import { parsePlayerParams } from "@/lib/hiscores/params";
import { playerQuery, type PlayerRow } from "@/lib/hiscores/queries";

/**
 * `GET /api/hiscores/player/<username>?profile=main`
 *
 * Every category the player appears in, with a rank for each. A player with no
 * rows at all is a 404 `{ "error": "not_found" }` — the personal page turns
 * that into "No player <Name> found" rather than an empty table, because an
 * empty table there is indistinguishable from a typo.
 */
export async function GET(
  request: NextRequest,
  context: RouteContext<"/api/hiscores/player/[username]">,
) {
  const { username } = await context.params;
  const parsed = parsePlayerParams(username, request.nextUrl.searchParams);
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
    const statement = playerQuery(parsed.value);
    const rows = await query<PlayerRow>(statement.text, statement.values);

    if (rows.length === 0) {
      return Response.json(
        { error: "not_found" },
        { status: 404, headers: { "Cache-Control": HISCORES_CACHE_CONTROL } },
      );
    }

    return Response.json(
      toPlayerResponse(parsed.value.username, rows, displayName),
      { headers: { "Cache-Control": HISCORES_CACHE_CONTROL } },
    );
  } catch (error) {
    console.error("hiscores player query failed", error);
    return Response.json(
      { error: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
