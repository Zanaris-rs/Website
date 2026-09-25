import type { NextRequest } from "next/server";

import { readSession } from "@/lib/account/session-server";
import { nameFrom } from "@/lib/adventurer-log/name";
import { parseCursor } from "@/lib/adventurer-log/queries";
import { loadTimeline } from "@/lib/adventurer-log/view";
import { isConfigured } from "@/lib/db";

/**
 * `GET /api/adventurer-log/<name>/timeline?at=&rank=&id=` — the next page of
 * a log's timeline, before the cursor, in the shape the page's first one
 * came in (`TimelinePage`). The viewer is the signed session's name, if
 * any: the owner sees their own adventures without the twenty minutes.
 * Never cached - it depends on who is asking and on the clock.
 */

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" } as const;

export async function GET(
  request: NextRequest,
  context: RouteContext<"/api/adventurer-log/[username]/timeline">,
) {
  const username = nameFrom((await context.params).username);
  if (!username) {
    return Response.json({ error: "bad_name" }, { status: 400, headers: NO_STORE });
  }

  const before = parseCursor(request.nextUrl.searchParams);
  if (!before) {
    return Response.json({ error: "bad_cursor" }, { status: 400, headers: NO_STORE });
  }

  if (!isConfigured()) {
    return Response.json({ error: "unavailable" }, { status: 503, headers: NO_STORE });
  }

  const viewer = (await readSession())?.u ?? null;
  try {
    const page = await loadTimeline(username, viewer, before);
    return Response.json(page, { status: 200, headers: NO_STORE });
  } catch (error) {
    console.error("[adventurer-log] timeline read failed", error);
    return Response.json({ error: "unavailable" }, { status: 503, headers: NO_STORE });
  }
}
