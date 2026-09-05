import type { NextRequest } from "next/server";

import { assertSameOrigin } from "@/lib/account/origin";
import { clearSessionCookie } from "@/lib/account/session-server";

/**
 * `POST /api/account/logout` — drop this browser's cookie.
 *
 * A POST and not a link, because a GET that logs you out is a logout CSRF: an
 * `<img src>` on any page would sign the reader out. The Origin check is the
 * same one every mutating route runs.
 *
 * There is no session to invalidate server-side. A stateless cookie cannot be
 * revoked, so this clears the copy in *this* browser and nothing else; a
 * copy captured elsewhere keeps working until `exp`, which is what the
 * seven-day cap and `HttpOnly` are for. Changing the password is the button
 * that revokes everything.
 *
 * It succeeds whether or not there was a cookie: "log me out" has no failure
 * mode worth reporting, and a 401 here would only confuse a page that is
 * about to redirect anyway.
 */

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" } as const;

export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request.headers)) {
    console.warn("[logout] refused: cross-origin POST");
    return Response.json(
      { error: "origin" },
      { status: 403, headers: NO_STORE },
    );
  }

  await clearSessionCookie();
  console.log("[logout] ok");
  return Response.json({ ok: true }, { status: 200, headers: NO_STORE });
}
