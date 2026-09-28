import type { NextRequest } from "next/server";

import { searchCrests } from "@/lib/clans/crests";

/**
 * `GET /api/clans/crests?q=rune` - items a clan can take as its crest. With
 * no query it answers the curated few; otherwise every item that is not a
 * note and has an icon, whose name holds the query (`lib/clans/crests.ts`).
 * Public and the same for everyone, so it is cached for an hour, like the
 * post picker's assets. The browser never loads the item tables itself.
 */
export function GET(request: NextRequest) {
  const crests = searchCrests(request.nextUrl.searchParams.get("q") ?? "");
  return Response.json({ crests }, { status: 200, headers: { "Cache-Control": "public, max-age=3600" } });
}
