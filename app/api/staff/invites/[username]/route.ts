import type { NextRequest } from "next/server";

import { assertSameOrigin } from "@/lib/account/origin";
import { readSession } from "@/lib/account/session-server";
import { canonicalizeUsername } from "@/lib/account/validation";
import { isConfigured, query } from "@/lib/db";
import {
  inviteStatusFor,
  parseStaffSetInvitesResult,
  staffSetInvitesStatement,
} from "@/lib/invite/queries";
import { candidateHash } from "@/lib/staff/actor-server";
import { loadStaff } from "@/lib/staff/staff-server";

/**
 * `POST /api/staff/invites/<username>` — switch one account's inviting on or
 * off. `{ enabled, password }`.
 *
 * `accounts.staff_set_invites` is the only way the website turns inviting on,
 * and switching it off revokes every unused link the account holds, in the
 * same statement. The password is re-typed, like every staff verb that changes
 * what somebody else can do: handing out the ability to let people in is not
 * something a leaked website credential should be able to do.
 */

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" } as const;

function fail(error: string, status: number): Response {
  return Response.json({ error }, { status, headers: NO_STORE });
}

type Body = { enabled?: unknown; password?: unknown };

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export async function POST(
  request: NextRequest,
  context: RouteContext<"/api/staff/invites/[username]">,
) {
  let payload: Body;
  try {
    payload = (await request.json()) as Body;
  } catch {
    return fail("bad_request", 400);
  }

  const session = await readSession();
  if (!session) return fail("session_expired", 401);

  if (!assertSameOrigin(request.headers)) {
    console.warn("[staff] refused: cross-origin invites switch");
    return fail("origin", 403);
  }

  const staff = await loadStaff(session);
  if (staff.status === "unavailable") return fail("unavailable", 503);
  if (staff.status === "signed_out") return fail("session_expired", 401);
  if (staff.status === "forbidden") return fail("forbidden", 403);

  const { username: raw } = await context.params;
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {}
  const target = canonicalizeUsername(decoded);
  if (!target.ok) return fail("not_found", 404);

  if (typeof payload.enabled !== "boolean") return fail("invalid", 400);

  if (!isConfigured()) return fail("unavailable", 503);

  const actor = staff.profile.username;

  try {
    const candidate = await candidateHash(actor, asString(payload.password));
    if (!candidate.ok) return fail(candidate.error, candidate.status);

    const statement = staffSetInvitesStatement(
      actor,
      candidate.hash,
      target.value,
      payload.enabled,
    );
    const rows = await query<{ result: unknown }>(
      statement.text,
      statement.values,
    );
    const result = parseStaffSetInvitesResult(rows[0]?.result);

    if (result !== "ok") {
      console.warn(`[staff] invites switch ${result}`);
      return fail(result, inviteStatusFor(result));
    }

    console.log(`[staff] inviting switched ${payload.enabled ? "on" : "off"}`);
    return Response.json({ ok: true }, { status: 200, headers: NO_STORE });
  } catch (error) {
    console.error("[staff] invites switch failed", error);
    return fail("unavailable", 503);
  }
}
