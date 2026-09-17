/**
 * Whether a request for `/join/<code>` is a person actually landing on the
 * page, rather than a browser fetching it as a sub-resource of somebody
 * else's page.
 *
 * A real invite click - even one opened inside Discord's in-app browser - is
 * a top-level navigation: the browser sends `sec-fetch-dest: document`. An
 * `<img src="https://zanaris.rs/join/…">` embedded in an unrelated page is
 * not; Chrome and Firefox send `sec-fetch-dest: image` for it, and an
 * `<iframe>` or `<script src>` pointed at the same URL send `iframe` and
 * `script`. Thirty of those tags on one page would otherwise spend the
 * bad-code rate limit against a visitor's IP for a link they never actually
 * opened - see the `invite_attempt` row `accounts.invite_preview` writes for
 * every check. A browser old enough to send no Fetch Metadata headers at
 * all, or a link unfurler that strips them, sends no `sec-fetch-dest`
 * either, so absence also reads as top-level: the guard only ever refuses a
 * *known* sub-resource fetch, never an unrecognised one.
 */

type HeaderSource = { get(name: string): string | null };

export function isTopLevelNavigation(headers: HeaderSource): boolean {
  const dest = headers.get("sec-fetch-dest");
  return dest === null || dest === "document";
}
