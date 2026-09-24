import type { NextRequest } from "next/server";

import { ABOUT_MAX, checkText, HEADLINE_MAX } from "@/lib/adventurer-log/format";
import { logSaveStatement } from "@/lib/adventurer-log/queries";
import { fail, readJson, runWrite, writer } from "@/lib/adventurer-log/route";

/**
 * `POST /api/adventurer-log/profile` `{ headline, about }` — the owner's own
 * words at the top of their log. A mute stops this too: it is public text.
 */

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = await readJson(request);
  if (!body) return fail("bad_request", 400);

  const who = await writer(request, "profile");
  if ("response" in who) return who.response;

  const headline = checkText(body.headline ?? "", "The headline", HEADLINE_MAX, {
    emptyOk: true,
    oneLine: true,
  });
  if (!headline.ok) return fail(headline.error, 400);
  const about = checkText(body.about ?? "", "About you", ABOUT_MAX, { emptyOk: true });
  if (!about.ok) return fail(about.error, 400);

  return runWrite(logSaveStatement(who.username, headline.value, about.value), "profile");
}
