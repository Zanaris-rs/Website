import type { NextRequest } from "next/server";

import { assertSameOrigin } from "@/lib/account/origin";
import { requireLiveSession } from "@/lib/account/session-server";
import { isConfigured, query } from "@/lib/db";
import { newInviteCode } from "@/lib/invite/code-server";
import {
  inviteCreateStatement,
  inviteStatusFor,
  parseInviteCreated,
} from "@/lib/invite/queries";

/**
 * `POST /api/account/invites` — mint one invite link for the signed-in
 * account. No body.
 *
 * Whether this account may invite, and whether it already holds twenty live
 * links, is decided by `accounts.invite_create`. The code is made here, from
 * ten random bytes; a collision on the unique index answers `retry`, and one
 * retry is plenty at eighty bits.
 */

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" } as const;

function fail(error: string, status: number): Response {
  return Response.json({ error }, { status, headers: NO_STORE });
}

export async function POST(request: NextRequest) {
  const live = await requireLiveSession();
  if (live.status !== "ok") {
    return fail(live.refusal.error, live.refusal.status);
  }

  if (!assertSameOrigin(request.headers)) {
    console.warn("[invites] refused: cross-origin POST");
    return fail("origin", 403);
  }

  if (!isConfigured()) return fail("unavailable", 503);

  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const statement = inviteCreateStatement(
        live.profile.username,
        newInviteCode(),
      );
      const rows = await query<Record<string, unknown>>(
        statement.text,
        statement.values,
      );
      const created = parseInviteCreated(rows[0]);

      if (created.result === "retry") continue;
      if (created.result !== "ok") {
        return fail(created.result, inviteStatusFor(created.result));
      }

      console.log("[invites] link created");
      return Response.json(
        { ok: true, code: created.code, expiresAt: created.expiresAt },
        { status: 200, headers: NO_STORE },
      );
    }

    console.error("[invites] two code collisions in a row");
    return fail("unavailable", 503);
  } catch (error) {
    console.error("[invites] create failed", error);
    return fail("unavailable", 503);
  }
}
