import type { NextRequest } from "next/server";

import { searchAssets } from "@/lib/adventurer-log/assets";

/**
 * `GET /api/adventurer-log/assets?q=rune` — items and skills to drop into a
 * post, with the shortcode for each. Public, and the same for everyone, so it
 * is cached briefly; it changes only when the item tables are regenerated.
 */
export function GET(request: NextRequest) {
  const matches = searchAssets(request.nextUrl.searchParams.get("q") ?? "");
  return Response.json(
    { matches },
    { status: 200, headers: { "Cache-Control": "public, max-age=3600" } },
  );
}
