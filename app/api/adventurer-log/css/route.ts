import type { NextRequest } from "next/server";

import { sanitizeCss } from "@/lib/adventurer-log/css";
import { CSS_MAX } from "@/lib/adventurer-log/format";
import { logStatusFor, parseWrite, saveCssStatement } from "@/lib/adventurer-log/queries";
import { fail, NO_STORE, readJson, writer } from "@/lib/adventurer-log/route";
import { query } from "@/lib/db";

/**
 * `POST /api/adventurer-log/css` `{ css }` — the owner's stylesheet. Stored as
 * written; the log sanitises it every time it is drawn. The answer says what
 * the sanitiser would take out now, `{ dropped }`, so the owner is not left
 * wondering why a rule does nothing.
 */

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const payload = await readJson(request);
  if (!payload || typeof payload.css !== "string") return fail("bad_request", 400);

  const who = await writer(request, "css");
  if ("response" in who) return who.response;

  const css = payload.css.replace(/\r\n/g, "\n");
  if (css.length > CSS_MAX) return fail(`Your stylesheet can be at most ${CSS_MAX} characters.`, 400);

  try {
    const statement = saveCssStatement(who.username, css);
    const rows = await query<{ result: unknown }>(statement.text, statement.values);
    const result = parseWrite(rows[0]?.result, "css");
    if (result !== "ok") {
      console.warn(`[adventurer-log] css ${result}`);
      return fail(result, logStatusFor(result));
    }
    const { dropped } = sanitizeCss(css, who.username, CSS_MAX);
    return Response.json({ ok: true, dropped }, { status: 200, headers: NO_STORE });
  } catch (error) {
    console.error("[adventurer-log] css failed", error);
    return fail("unavailable", 503);
  }
}
