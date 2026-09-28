import type { NextRequest } from "next/server";

import { fail, readJson, runWrite, writer } from "@/lib/adventurer-log/route";
import { INVALID_NAME, toSafeName } from "@/lib/base37";
import { CLAN_ANSWERS, clanInviteCancelStatement, clanInviteStatement } from "@/lib/clans/queries";

/**
 * `POST /api/clans/invites` `{ target }` invites a player to your clan;
 * `DELETE` with the same body takes the invitation back. Both need a rank
 * that may invite (`perm_invite`). The name is resolved as the blocks'
 * are: a name base37 cannot hold is nobody.
 */

export const runtime = "nodejs";

async function handle(request: NextRequest, cancel: boolean) {
  const payload = await readJson(request);
  if (!payload || typeof payload.target !== "string") return fail("bad_request", 400);
  const target = toSafeName(payload.target);
  if (target === INVALID_NAME) return fail(cancel ? "no_invite" : "no_such_player", 404);

  const who = await writer(request, cancel ? "clan invite cancel" : "clan invite");
  if ("response" in who) return who.response;

  return cancel
    ? runWrite(clanInviteCancelStatement(who.username, target), "clan_invite_cancel", CLAN_ANSWERS)
    : runWrite(clanInviteStatement(who.username, target), "clan_invite", CLAN_ANSWERS);
}

export async function POST(request: NextRequest) {
  return handle(request, false);
}

export async function DELETE(request: NextRequest) {
  return handle(request, true);
}
