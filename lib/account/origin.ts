/**
 * The CSRF check on every mutating route: does the `Origin` header name this
 * site?
 *
 * `SameSite=Lax` already stops a cross-site *form* POST from carrying the
 * session cookie, so this is the second lock rather than the first. It is
 * worth having because Lax is a browser policy — an old browser, a browser
 * with a bug, or a request that is not a navigation at all — and because it
 * turns a subtle failure (the request runs without a session and does
 * something confusing) into an explicit 403.
 *
 * **A missing `Origin` is a rejection.** Browsers send it on every `fetch` and
 * on every cross-origin form POST; a POST without one is a client that is not
 * a browser, and this site has no non-browser clients. `Origin: null` — a
 * sandboxed iframe, a `data:` document, some redirect chains — is rejected for
 * the same reason: it names no site, so it cannot name ours.
 *
 * The host it is compared against is `x-forwarded-host` where there is one,
 * because Vercel terminates TLS in front of the app and `host` there is the
 * internal name. Both headers are set by the platform on that path. Behind
 * anything else they are attacker-controlled, which is the same caveat
 * `lib/account/ip.ts` carries for `x-forwarded-for` and the same answer: this
 * runs on Vercel.
 */

/** Anything that can answer `get`, i.e. `Headers` or a plain map. */
type HeaderSource = { get(name: string): string | null };

/**
 * Is `origin` the same site as `host`?
 *
 * Compares the *host* (name and port), not the scheme: on Vercel the browser's
 * origin is `https://` while the request reaching the function may not be, and
 * a scheme comparison would reject every real request.
 */
export function sameOrigin(
  origin: string | null | undefined,
  host: string | null | undefined,
): boolean {
  if (!origin || !host) return false;
  // The literal string "null" is what a sandboxed context sends. It is not a
  // URL and must never be treated as a wildcard.
  if (origin === "null") return false;

  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    return false;
  }

  return parsed.host.toLowerCase() === host.trim().toLowerCase();
}

/** The host this request was addressed to, as the platform reports it. */
export function requestHost(headers: HeaderSource): string | null {
  return headers.get("x-forwarded-host") ?? headers.get("host");
}

/** `true` when the request may proceed; the caller turns `false` into a 403. */
export function assertSameOrigin(headers: HeaderSource): boolean {
  return sameOrigin(headers.get("origin"), requestHost(headers));
}

/**
 * The same question for the two GETs that write, asked of `Sec-Fetch-Site`
 * instead of `Origin`.
 *
 * `Origin` is no help here: browsers omit it on a GET, so there would be
 * nothing to compare. `Sec-Fetch-Site` is sent on every request by every
 * current browser, cannot be set by script, and says exactly what is needed —
 * where the request came from relative to us.
 *
 * `accounts.message` and `accounts.ticket_thread` mark what they return as
 * read, so a link on another site, followed by a signed-in reader, silently
 * marks one of their messages read: `SameSite=Lax` sends the cookie on a
 * top-level GET navigation, which is what makes the request work at all. The
 * damage is cosmetic — the in-game "you have unread messages" alert stops
 * mentioning that one — but a GET that writes should not be reachable from
 * somebody else's page, and this is the cheapest way to say so.
 *
 * **Only `same-origin` passes.** `cross-site` and `same-site` are the attack;
 * `none` is a direct address-bar visit or a bookmark, which is not how these
 * are used — the pages read the database themselves and these routes exist for
 * `fetch`. A browser too old to send the header at all gets a 403 rather than
 * a pass, which is the fail-closed direction and costs nothing the site
 * itself uses.
 */
export function assertSameOriginFetch(headers: HeaderSource): boolean {
  return headers.get("sec-fetch-site") === "same-origin";
}
