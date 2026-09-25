import type { NextRequest } from "next/server";

import { ADVENTURE_CATEGORIES, maskOf } from "@/lib/adventurer-log/categories";
import { ABOUT_MAX, checkText, HEADLINE_MAX } from "@/lib/adventurer-log/format";
import { aboutSaveStatement, logStatusFor, parseAboutSave } from "@/lib/adventurer-log/queries";
import { fail, NO_STORE, readJson, writer } from "@/lib/adventurer-log/route";
import { query } from "@/lib/db";

/**
 * `POST /api/adventurer-log/about` `{ headline, about, hidden: number[] }` -
 * the settings page's "About you" box in one Save: the owner's own words at
 * the top of their log, and the kinds of adventure it does not show (for
 * everyone, the owner included). Both or neither: they are one statement.
 * A mute refuses it, because the words are public text.
 */

export const runtime = "nodejs";

const KNOWN = new Set(ADVENTURE_CATEGORIES.map((category) => category.id));

export async function POST(request: NextRequest) {
  const body = await readJson(request);
  if (
    !body ||
    !Array.isArray(body.hidden) ||
    !body.hidden.every((id) => Number.isInteger(id) && KNOWN.has(id as number))
  ) {
    return fail("bad_request", 400);
  }

  const who = await writer(request, "about");
  if ("response" in who) return who.response;

  const headline = checkText(body.headline ?? "", "The headline", HEADLINE_MAX, {
    emptyOk: true,
    oneLine: true,
  });
  if (!headline.ok) return fail(headline.error, 400);
  const about = checkText(body.about ?? "", "About you", ABOUT_MAX, { emptyOk: true });
  if (!about.ok) return fail(about.error, 400);

  try {
    const statement = aboutSaveStatement(
      who.username,
      headline.value,
      about.value,
      maskOf(body.hidden as number[]),
    );
    const rows = await query<Record<string, unknown>>(statement.text, statement.values);
    const result = parseAboutSave(rows[0]);
    if (result !== "ok") {
      console.warn(`[adventurer-log] about ${result}`);
      return fail(result, logStatusFor(result));
    }
    return Response.json(
      { ok: true, headline: headline.value, about: about.value },
      { status: 200, headers: NO_STORE },
    );
  } catch (error) {
    console.error("[adventurer-log] about failed", error);
    return fail("unavailable", 503);
  }
}
