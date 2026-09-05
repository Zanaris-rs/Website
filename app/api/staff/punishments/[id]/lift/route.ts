import type { NextRequest } from "next/server";

import { assertSameOrigin } from "@/lib/account/origin";
import { readSession } from "@/lib/account/session-server";
import { parseId, statusFor } from "@/lib/messages/queries";
import { candidateHash } from "@/lib/staff/actor-server";
import { PUBLIC_NOTE_MAX } from "@/lib/staff/format";
import {
  parseStaffLiftResult,
  staffLiftStatement,
} from "@/lib/staff/queries";
import { loadStaff } from "@/lib/staff/staff-server";
import { isConfigured, query } from "@/lib/db";

/**
 * `POST /api/staff/punishments/<id>/lift` — reverse a ban or a mute.
 * `{ note, password }`.
 *
 * `accounts.staff_lift` clears `account.banned_until` or `muted_until` and
 * stamps `punishment.lifted_at`, both in one statement, because those two
 * facts drifting apart is the failure this replaces: the old way to un-ban
 * somebody was a `psql` UPDATE on `account`, which left the public record
 * saying they were still banned.
 *
 * The row is **never deleted**. A permanent record that quietly loses the
 * entries somebody changed their mind about is not a record, so a lifted
 * punishment stays on `/bans` and says it was lifted, with the optional
 * one-line note the moderator writes here.
 *
 * Nothing in this route knows whether it is a ban or a mute: the punishment id
 * is the whole of the request, and the function reads the kind off the row.
 */

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" } as const;

function fail(error: string, status: number): Response {
  return Response.json({ error }, { status, headers: NO_STORE });
}

type Body = { note?: unknown; password?: unknown };

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export async function POST(
  request: NextRequest,
  context: RouteContext<"/api/staff/punishments/[id]/lift">,
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
    console.warn("[staff] refused: cross-origin lift");
    return fail("origin", 403);
  }

  const staff = await loadStaff(session);
  if (staff.status === "unavailable") return fail("unavailable", 503);
  if (staff.status === "signed_out") return fail("session_expired", 401);
  if (staff.status === "forbidden") return fail("forbidden", 403);

  const { id: raw } = await context.params;
  const id = parseId(raw);
  if (id === null) return fail("not_found", 404);

  // The note goes on a public page, so it is one line and it is short.
  const note = asString(payload.note).replace(/\s+/g, " ").trim();
  if (note.length > PUBLIC_NOTE_MAX) return fail("note_long", 400);

  if (!isConfigured()) return fail("unavailable", 503);

  const actor = staff.profile.username;

  try {
    const candidate = await candidateHash(actor, asString(payload.password));
    if (!candidate.ok) return fail(candidate.error, candidate.status);

    const statement = staffLiftStatement(actor, candidate.hash, id, note);
    const rows = await query<{ result: unknown }>(
      statement.text,
      statement.values,
    );
    const result = parseStaffLiftResult(rows[0]?.result);

    if (result !== "ok") {
      console.warn(`[staff] lift ${result}`);
      return fail(result, statusFor(result));
    }

    console.log("[staff] punishment lifted");
    return Response.json({ ok: true }, { status: 200, headers: NO_STORE });
  } catch (error) {
    console.error("[staff] lift failed", error);
    return fail("unavailable", 503);
  }
}
