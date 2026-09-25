import type { NextRequest } from "next/server";

import { takeIds } from "@/lib/adventurer-log/gz";
import { gzGiveStatement, gzTakeStatement } from "@/lib/adventurer-log/queries";
import { fail, readJson, runWrite, writer } from "@/lib/adventurer-log/route";
import { parseId } from "@/lib/messages/queries";

/**
 * `POST /api/adventurer-log/gz` `{ event }` says "gz" to an adventure on
 * someone else's log; saying it twice is the same as once. The database
 * refuses the owner ('self'), a player they blocked ('blocked'), a banned
 * account, an adventure nobody else can see yet ('not_found') and more than
 * 300 an hour. Not a mute: a gz has no words.
 *
 * `DELETE /api/adventurer-log/gz` `{ events }` takes your gz back from one to
 * fifty adventures - all of a level run's at once. Ids you never gave to are
 * no matter.
 */

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const payload = await readJson(request);
  if (!payload || typeof payload.event !== "number") return fail("bad_request", 400);

  const who = await writer(request, "gz");
  if ("response" in who) return who.response;

  // A number that is not a row id (0, -1, 1.5, past int4) is an adventure
  // that cannot exist, the same answer as one that does not.
  const id = parseId(String(payload.event));
  if (id === null) return fail("not_found", 404);

  return runWrite(gzGiveStatement(who.username, id), "gz give");
}

export async function DELETE(request: NextRequest) {
  const payload = await readJson(request);
  const ids = payload ? takeIds(payload.events) : null;
  if (!ids) return fail("bad_request", 400);

  const who = await writer(request, "gz take");
  if ("response" in who) return who.response;

  return runWrite(gzTakeStatement(who.username, ids), "gz take");
}
