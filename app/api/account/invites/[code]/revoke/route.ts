import type { NextRequest } from "next/server";

import { assertSameOrigin } from "@/lib/account/origin";
import { requireLiveSession } from "@/lib/account/session-server";
import { isConfigured, query } from "@/lib/db";
import { normalizeInviteCode } from "@/lib/invite/code";
import {
  inviteRevokeStatement,
  inviteStatusFor,
  parseInviteRevokeResult,
} from "@/lib/invite/queries";

/**
 * `POST /api/account/invites/<code>/revoke` — cancel one of your own unused
 * links. Somebody else's code, a dead link and a code that never existed all
 * answer `not_found`; a link that was used answers `already_claimed`.
 */

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" } as const;

function fail(error: string, status: number): Response {
  return Response.json({ error }, { status, headers: NO_STORE });
}

export async function POST(
  request: NextRequest,
  context: RouteContext<"/api/account/invites/[code]/revoke">,
) {
  const live = await requireLiveSession();
  if (live.status !== "ok") {
    return fail(live.refusal.error, live.refusal.status);
  }

  if (!assertSameOrigin(request.headers)) {
    console.warn("[invites] refused: cross-origin revoke");
    return fail("origin", 403);
  }

  const { code: raw } = await context.params;
  const code = normalizeInviteCode(raw);
  if (!code) return fail("not_found", 404);

  if (!isConfigured()) return fail("unavailable", 503);

  try {
    const statement = inviteRevokeStatement(live.profile.username, code);
    const rows = await query<{ result: unknown }>(
      statement.text,
      statement.values,
    );
    const result = parseInviteRevokeResult(rows[0]?.result);

    if (result !== "ok") return fail(result, inviteStatusFor(result));

    console.log("[invites] link cancelled");
    return Response.json({ ok: true }, { status: 200, headers: NO_STORE });
  } catch (error) {
    console.error("[invites] revoke failed", error);
    return fail("unavailable", 503);
  }
}
