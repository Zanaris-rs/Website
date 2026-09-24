import type { NextRequest } from "next/server";

import { assertSameOrigin } from "@/lib/account/origin";
import { readSession } from "@/lib/account/session-server";
import {
  parseResolve,
  RESOLVE_STATUS,
  STAFF_ACTIONS,
  type StaffAction,
  staffResolveStatement,
} from "@/lib/adventurer-log/staff";
import { isConfigured, query } from "@/lib/db";
import { parseId } from "@/lib/messages/queries";
import { candidateHash } from "@/lib/staff/actor-server";
import { STAFF_NOTE_MAX } from "@/lib/staff/format";
import { loadStaff } from "@/lib/staff/staff-server";

/**
 * `POST /api/staff/adventure-reports/<id>/resolve` `{ action, note, password }`
 * — hide the reported update or reply (or clear a log's headline and about),
 * turn a log's stylesheet off, or dismiss. One decision answers every open
 * report on the same thing. The password is re-typed, as for game reports:
 * a stolen session cannot take down what players wrote.
 */

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" } as const;

function fail(error: string, status: number): Response {
  return Response.json({ error }, { status, headers: NO_STORE });
}

export async function POST(
  request: NextRequest,
  context: RouteContext<"/api/staff/adventure-reports/[id]/resolve">,
) {
  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return fail("bad_request", 400);
  }

  const session = await readSession();
  if (!session) return fail("session_expired", 401);
  if (!assertSameOrigin(request.headers)) {
    console.warn("[staff] refused: cross-origin adventure resolve");
    return fail("origin", 403);
  }

  const staff = await loadStaff(session);
  if (staff.status === "unavailable") return fail("unavailable", 503);
  if (staff.status === "signed_out") return fail("session_expired", 401);
  if (staff.status === "forbidden") return fail("forbidden", 403);

  const id = parseId((await context.params).id);
  if (id === null) return fail("not_found", 404);

  const action = payload.action;
  if (typeof action !== "string" || !(STAFF_ACTIONS as readonly string[]).includes(action)) {
    return fail("invalid", 400);
  }
  const note = typeof payload.note === "string" ? payload.note.trim() : "";
  if (note.length > STAFF_NOTE_MAX) return fail("body_long", 400);

  if (!isConfigured()) return fail("unavailable", 503);

  const actor = staff.profile.username;
  try {
    const candidate = await candidateHash(actor, typeof payload.password === "string" ? payload.password : "");
    if (!candidate.ok) return fail(candidate.error, candidate.status);

    const statement = staffResolveStatement(actor, candidate.hash, id, action as StaffAction, note);
    const rows = await query<{ result: unknown }>(statement.text, statement.values);
    const result = parseResolve(rows[0]?.result);
    if (result !== "ok") {
      console.warn(`[staff] adventure resolve ${result}`);
      return fail(result, RESOLVE_STATUS[result]);
    }
    console.log(`[staff] adventure report resolved: ${action}`);
    return Response.json({ ok: true }, { status: 200, headers: NO_STORE });
  } catch (error) {
    console.error("[staff] adventure resolve failed", error);
    return fail("unavailable", 503);
  }
}
