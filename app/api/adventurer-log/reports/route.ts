import type { NextRequest } from "next/server";

import { checkText, REASON_MAX } from "@/lib/adventurer-log/format";
import { type ReportKind, reportStatement } from "@/lib/adventurer-log/queries";
import { fail, readJson, runWrite, writer } from "@/lib/adventurer-log/route";
import { INVALID_NAME, toSafeName } from "@/lib/base37";

/**
 * `POST /api/adventurer-log/reports` — report an update or a reply
 * `{ kind, id, reason }`, or a whole log's own text and style
 * `{ kind: "log", name, reason }`. Staff see them at /staff/adventure-reports.
 */

export const runtime = "nodejs";

const KINDS: readonly ReportKind[] = ["update", "reply", "log"];

export async function POST(request: NextRequest) {
  const payload = await readJson(request);
  if (!payload) return fail("bad_request", 400);

  const kind = payload.kind;
  if (typeof kind !== "string" || !(KINDS as readonly string[]).includes(kind)) {
    return fail("bad_request", 400);
  }

  let targetId: number | null = null;
  let logName: string | null = null;
  if (kind === "log") {
    const name = typeof payload.name === "string" ? toSafeName(payload.name) : INVALID_NAME;
    if (name === INVALID_NAME) return fail("not_found", 404);
    logName = name;
  } else {
    if (!Number.isInteger(payload.id) || (payload.id as number) < 1) return fail("not_found", 404);
    targetId = payload.id as number;
  }

  const who = await writer(request, "report");
  if ("response" in who) return who.response;

  const reason = checkText(payload.reason, "The reason", REASON_MAX);
  if (!reason.ok) return fail(reason.error, 400);

  return runWrite(reportStatement(who.username, kind as ReportKind, targetId, logName, reason.value), "report");
}
