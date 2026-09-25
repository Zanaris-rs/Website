import type { NextRequest } from "next/server";

import { pinStatement } from "@/lib/adventurer-log/queries";
import { fail, readJson, runWrite, writer } from "@/lib/adventurer-log/route";
import { parseId } from "@/lib/messages/queries";

/**
 * `PUT /api/adventurer-log/pin` `{ id }` — pin one of your own updates to the
 * top of your log, in place of any other; `{ id: null }` unpins. Not a mute:
 * it moves words already there. `id` must be there, a number or null.
 */

export const runtime = "nodejs";

export async function PUT(request: NextRequest) {
  const payload = await readJson(request);
  if (!payload || (payload.id !== null && typeof payload.id !== "number")) {
    return fail("bad_request", 400);
  }

  const who = await writer(request, "pin");
  if ("response" in who) return who.response;

  // A number that is not a row id (0, -1, 1.5, past int4) is an update that
  // cannot exist, the same answer as one that does not.
  const id = payload.id === null ? null : parseId(String(payload.id));
  if (payload.id !== null && id === null) return fail("not_found", 404);

  return runWrite(pinStatement(who.username, id), "pin");
}
