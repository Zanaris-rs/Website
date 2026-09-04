import type { NextRequest } from "next/server";

import { isConfigured, query } from "@/lib/db";
import { HISCORES_CACHE_CONTROL, toHiscoresResponse } from "@/lib/hiscores/api";
import { displayName } from "@/lib/hiscores/format";
import { parseTableParams } from "@/lib/hiscores/params";
import { tableQuery, type TableRow } from "@/lib/hiscores/queries";

/**
 * `GET /api/hiscores?profile=main&category=0&rank=500` (or `&name=`/`&username=`)
 *
 * One 21-row window of a category. An unknown name, or a rank past the end of
 * the table, is an empty `rows` array and a `null` highlight — not an error:
 * the page renders the chrome around an empty table, which is what the 2004
 * site did.
 */
export async function GET(request: NextRequest) {
  const parsed = parseTableParams(request.nextUrl.searchParams);
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
    const statement = tableQuery(parsed.value);
    const rows = await query<TableRow>(statement.text, statement.values);

    return Response.json(toHiscoresResponse(parsed.value, rows, displayName), {
      headers: { "Cache-Control": HISCORES_CACHE_CONTROL },
    });
  } catch (error) {
    console.error("hiscores table query failed", error);
    return Response.json(
      { error: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
