import "server-only";

import type { NextRequest } from "next/server";

import { assertSameOrigin } from "@/lib/account/origin";
import { requireLiveSession } from "@/lib/account/session-server";
import type { Statement } from "@/lib/account/register";
import { isConfigured, query } from "@/lib/db";

import { logStatusFor, parseWrite } from "./queries";

/**
 * What the Adventurer Log's write routes share: a live session (a cookie from
 * before a password change cannot write), the same-origin check, one
 * statement, and its answer as JSON. Every refusal is `{ error }` with the
 * status `LOG_STATUS` gives it - or, for the clan routes, which share these
 * too, `CLAN_STATUS` (lib/clans/queries.ts).
 */

export const NO_STORE = { "Cache-Control": "no-store" } as const;

export function fail(error: string, status: number): Response {
  return Response.json({ error }, { status, headers: NO_STORE });
}

export async function readJson(request: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return typeof body === "object" && body !== null ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** The signed-in writer's username, or the response refusing them. */
export async function writer(
  request: NextRequest,
  what: string,
): Promise<{ username: string } | { response: Response }> {
  const live = await requireLiveSession();
  if (live.status !== "ok") {
    return { response: fail(live.refusal.error, live.refusal.status) };
  }
  if (!assertSameOrigin(request.headers)) {
    console.warn(`[adventurer-log] refused: cross-origin ${what}`);
    return { response: fail("origin", 403) };
  }
  if (!isConfigured()) return { response: fail("unavailable", 503) };
  return { username: live.profile.username };
}

/**
 * How a write's answer is read, and the status each refusal gets. The log's
 * functions are the default; a clan write passes `CLAN_ANSWERS`
 * (lib/clans/queries.ts).
 */
export type WriteAnswers = {
  parse: (raw: unknown, where: string) => string;
  status: (result: string) => number;
};

const LOG_ANSWERS: WriteAnswers = { parse: parseWrite, status: logStatusFor };

/** Run a `select accounts.x(...) as result` write and answer it. */
export async function runWrite(
  statement: Statement,
  what: string,
  answers: WriteAnswers = LOG_ANSWERS,
): Promise<Response> {
  try {
    const rows = await query<{ result: unknown }>(statement.text, statement.values);
    const result = answers.parse(rows[0]?.result, what);
    if (result !== "ok") {
      console.warn(`[adventurer-log] ${what} ${result}`);
      return fail(result, answers.status(result));
    }
    return Response.json({ ok: true }, { status: 200, headers: NO_STORE });
  } catch (error) {
    console.error(`[adventurer-log] ${what} failed`, error);
    return fail("unavailable", 503);
  }
}
