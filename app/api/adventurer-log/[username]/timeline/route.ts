import type { NextRequest } from "next/server";

import { readSession } from "@/lib/account/session-server";
import { filterOf } from "@/lib/adventurer-log/filters";
import { nameFrom } from "@/lib/adventurer-log/name";
import { readPart } from "@/lib/adventurer-log/parts";
import { logStatement, parseCursor, parseLog } from "@/lib/adventurer-log/queries";
import { EMPTY_TIMELINE, loadTimeline } from "@/lib/adventurer-log/view";
import { isConfigured, query } from "@/lib/db";

/**
 * `GET /api/adventurer-log/<name>/timeline?at=&rank=&id=&show=` — the next
 * page of a log's timeline, before the cursor, in the shape the page's first
 * one came in (`TimelinePage`), under the same filter (`show`, a slug from
 * `filters.ts`; Everything for none or one it does not know). The viewer is
 * the signed session's name, if any: the owner sees their own adventures
 * without the twenty minutes. Never cached - it depends on who is asking and
 * on the clock.
 *
 * A log whose owner hides Adventures (migration 18's `hidden_parts`) answers
 * `EMPTY_TIMELINE`, 200, exactly as a log with no adventures does, and its
 * timeline is not read (`readPart`): the part is hidden from this route as
 * from the page. That is for everyone, the owner included; they turn it back
 * on in Log settings. A log that is not there, or banned, has no parts to
 * hide: its timeline read answers for it, as it always has.
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

  const show = filterOf(request.nextUrl.searchParams.get("show")).mask;
  const viewer = (await readSession())?.u ?? null;
  try {
    const wanted = logStatement(username, viewer);
    const header = parseLog(await query<Record<string, unknown>>(wanted.text, wanted.values));
    const hiddenParts = header.result === "ok" ? header.hiddenParts : 0;
    const page = await readPart(
      hiddenParts,
      "adventures",
      () => loadTimeline(username, viewer, before, show),
      EMPTY_TIMELINE,
    );
    return Response.json(page, { status: 200, headers: NO_STORE });
  } catch (error) {
    console.error("[adventurer-log] timeline read failed", error);
    return Response.json({ error: "unavailable" }, { status: 503, headers: NO_STORE });
  }
}
