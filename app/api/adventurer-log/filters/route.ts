import type { NextRequest } from "next/server";

import { maskOf } from "@/lib/adventurer-log/categories";
import { setHiddenStatement } from "@/lib/adventurer-log/queries";
import { fail, readJson, runWrite, writer } from "@/lib/adventurer-log/route";

/**
 * `POST /api/adventurer-log/filters` `{ hidden: number[] }` — the kinds of
 * adventure the owner's log does not show, for everyone including them.
 */

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = await readJson(request);
  if (!body || !Array.isArray(body.hidden) || !body.hidden.every((id) => Number.isInteger(id))) {
    return fail("bad_request", 400);
  }

  const who = await writer(request, "filters");
  if ("response" in who) return who.response;

  return runWrite(setHiddenStatement(who.username, maskOf(body.hidden as number[])), "filters");
}
