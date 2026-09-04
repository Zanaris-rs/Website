/**
 * Cloudflare Turnstile verification.
 *
 * With email verification gone, this is the load-bearing half of the signup
 * gate: everything else is rate limiting. So it **fails closed** — a missing
 * token, a missing secret, a network error, a non-2xx, a malformed body or a
 * `success: false` all come back `false`, and the route turns that into a 400.
 * There is no path through this function that lets a registration proceed on
 * "the check didn't run".
 */

const SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** siteverify is a single POST in the same datacentre; 5s is generous. */
const TIMEOUT_MS = 5_000;

export type TurnstileOptions = {
  readonly token: string | null | undefined;
  readonly secret: string | null | undefined;
  readonly remoteIp?: string | null;
  /** Test seam. */
  readonly fetchImpl?: typeof fetch;
};

export async function verifyTurnstile({
  token,
  secret,
  remoteIp,
  fetchImpl = fetch,
}: TurnstileOptions): Promise<boolean> {
  // No secret means the gate is not configured. That is exactly when a bot
  // farm gets in for free, so refuse rather than skip.
  if (!secret || !token) return false;

  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set("remoteip", remoteIp);

  try {
    const response = await fetchImpl(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!response.ok) return false;

    const result: unknown = await response.json();
    return (
      typeof result === "object" &&
      result !== null &&
      (result as { success?: unknown }).success === true
    );
  } catch {
    return false;
  }
}
