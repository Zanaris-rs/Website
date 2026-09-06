import type { NextRequest } from "next/server";

import { assertSameOrigin } from "@/lib/account/origin";
import { readSession } from "@/lib/account/session-server";
import { validateBody } from "@/lib/messages/format";
import { parseId, statusFor } from "@/lib/messages/queries";
import { candidateHash } from "@/lib/staff/actor-server";
import { STAFF_NOTE_MAX } from "@/lib/staff/format";
import {
  isResolution,
  parseStaffResolveResult,
  staffReportResolveStatement,
} from "@/lib/staff/queries";
import { loadStaff } from "@/lib/staff/staff-server";
import { isConfigured, query } from "@/lib/db";

/**
 * `POST /api/staff/reports/<id>/resolve` — close a report.
 * `{ resolution, note, password }`.
 *
 * It re-types a password for the same reason `staff_notice` does, and for one
 * more: **`dismissed` deletes the evidence.** The input chunks and the chat
 * copy for that report's uuid are gone the moment this returns `ok`, which is
 * the decision the owner asked for — a report staff have looked at and thrown
 * out should not leave a record of somebody's mouse on a server for another
 * month. It is not reversible, so it is not something a stolen session can do.
 *
 * `watch` and `actioned` write a resolution and a note and delete nothing;
 * the ban itself is `::ban` in game, not this.
 */

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" } as const;

function fail(error: string, status: number): Response {
  return Response.json({ error }, { status, headers: NO_STORE });
}

type Body = { resolution?: unknown; note?: unknown; password?: unknown };

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export async function POST(
  request: NextRequest,
  context: RouteContext<"/api/staff/reports/[id]/resolve">,
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
    console.warn("[staff] refused: cross-origin resolve");
    return fail("origin", 403);
  }

  const staff = await loadStaff(session);
  if (staff.status === "unavailable") return fail("unavailable", 503);
  if (staff.status === "signed_out") return fail("session_expired", 401);
  if (staff.status === "forbidden") return fail("forbidden", 403);

  const { id: raw } = await context.params;
  const id = parseId(raw);
  if (id === null) return fail("not_found", 404);

  const resolution = asString(payload.resolution);
  if (!isResolution(resolution)) return fail("invalid", 400);

  // A note is optional. An empty one is stored as empty rather than refused:
  // "actioned" with nothing to add is a complete answer.
  const typed = asString(payload.note).trim();
  let note = "";
  if (typed !== "") {
    const validated = validateBody(typed);
    if (!validated.ok) return fail(validated.error, 400);
    if (validated.value.length > STAFF_NOTE_MAX) return fail("body_long", 400);
    note = validated.value;
  }

  if (!isConfigured()) return fail("unavailable", 503);

  const actor = staff.profile.username;

  try {
    const candidate = await candidateHash(actor, asString(payload.password));
    if (!candidate.ok) return fail(candidate.error, candidate.status);

    const statement = staffReportResolveStatement(
      actor,
      candidate.hash,
      id,
      resolution,
      note,
    );
    const rows = await query<{ result: unknown }>(
      statement.text,
      statement.values,
    );
    const result = parseStaffResolveResult(rows[0]?.result);

    if (result !== "ok") {
      console.warn(`[staff] resolve ${result}`);
      return fail(result, statusFor(result));
    }

    console.log(`[staff] report resolved: ${resolution}`);
    return Response.json(
      { ok: true, resolution },
      { status: 200, headers: NO_STORE },
    );
  } catch (error) {
    console.error("[staff] resolve failed", error);
    return fail("unavailable", 503);
  }
}
