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
