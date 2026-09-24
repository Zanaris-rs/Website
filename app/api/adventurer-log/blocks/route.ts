import type { NextRequest } from "next/server";

import { blockStatement, unblockStatement } from "@/lib/adventurer-log/queries";
import { fail, readJson, runWrite, writer } from "@/lib/adventurer-log/route";
import { INVALID_NAME, toSafeName } from "@/lib/base37";

/**
 * `POST /api/adventurer-log/blocks` `{ target }` blocks a player from replying
 * on your log (and stops their replies there showing); `DELETE` with the same
 * body lets them back.
 */

export const runtime = "nodejs";

async function handle(request: NextRequest, unblock: boolean) {
  const payload = await readJson(request);
  if (!payload || typeof payload.target !== "string") return fail("bad_request", 400);

  const who = await writer(request, unblock ? "unblock" : "block");
  if ("response" in who) return who.response;

  const target = toSafeName(payload.target);
  if (target === INVALID_NAME) return fail("no_such_player", 404);

  return runWrite(
    unblock ? unblockStatement(who.username, target) : blockStatement(who.username, target),
    unblock ? "unblock" : "block",
  );
}

export async function POST(request: NextRequest) {
  return handle(request, false);
}

export async function DELETE(request: NextRequest) {
  return handle(request, true);
}
