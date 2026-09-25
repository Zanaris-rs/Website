import type { NextRequest } from "next/server";

import { sanitizeCss } from "@/lib/adventurer-log/css";
import { checkCss, CSS_MAX } from "@/lib/adventurer-log/format";
import { fail, NO_STORE, readJson, writer } from "@/lib/adventurer-log/route";

/**
 * `POST /api/adventurer-log/css/check` `{ css }` -> `{ dropped }` — the
 * settings page's editor marks: the owner's draft through the sanitiser the
 * log itself uses, and what it would take out, each with the line it was on
 * (`[{ reason, line? }]`). Nothing is saved.
 *
 * It is the owner's own route all the same - a live session and the
 * same-origin check, as for a save - because a parser this generous should
 * not be anyone's to run. The editor asks once per pause in typing (about
 * 400 ms), not per keystroke.
 */

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const payload = await readJson(request);
  const draft = checkCss(payload?.css);
  if (!draft.ok) return fail(draft.error, 400);

  const who = await writer(request, "css check");
  if ("response" in who) return who.response;

  const { dropped } = sanitizeCss(draft.value, who.username, CSS_MAX);
  return Response.json({ dropped }, { status: 200, headers: NO_STORE });
}
