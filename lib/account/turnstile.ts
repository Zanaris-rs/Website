/**
 * Cloudflare Turnstile verification.
 *
 * With email verification gone, this is the load-bearing half of the signup
 * gate: everything else is rate limiting. So it **fails closed** — a missing
 * token, a missing secret, a network error, a non-2xx, a malformed body or a
 * `success: false` all come back `false`, and the route turns that into a 400.
 * There is no path through this function that lets a registration proceed on
 * "the check didn't run".
 *
 * `success: true` alone is not enough, though, and that is the part easy to
 * skip. A site key is public, so a token minted against our widget is a token
 * anyone can obtain: embed our site key on your own page, solve the challenge
 * there, post the result here. Cloudflare returns two fields that close that
 * off, and its own guidance is to check both:
 *
 * - **`action`** — the label the widget was rendered with. Ours is `signup`.
 *   A token minted by a differently-labelled widget, or by a page that never
 *   set one, is not a token for creating an account.
 * - **`hostname`** — where the challenge was actually solved. It has to be one
 *   of ours. This is what stops "lift the site key onto my own domain".
 *
 * Either field absent, or either one wrong, is a rejection — the same answer
 * as every other failure here, and the route still says 400.
 */

const SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** siteverify is a single POST in the same datacentre; 5s is generous. */
const TIMEOUT_MS = 5_000;

/**
 * The action the register widget is rendered with, and the only one this
 * endpoint accepts. `components/account/RegisterForm.tsx` renders the widget
 * with this exact value — it imports the constant rather than spelling the
 * string twice, so the two cannot drift apart.
 */
export const TURNSTILE_ACTION = "signup";

/**
 * The action the **login** widget carries. Separate from `signup` on purpose:
 * a token solved on the register page is not consent to attempt a login, and
 * the login endpoint is the one with a rate limiter behind it.
 * `components/account/LoginForm.tsx` imports this constant rather than
 * spelling the string again.
 */
export const TURNSTILE_LOGIN_ACTION = "login";

/**
 * Hostnames a challenge may legitimately have been solved on.
 *
 * The two live ones, the two local ones (`npm run dev`), and our own Vercel
 * project's production host, which is the deployment we can actually inspect.
 */
export const DEFAULT_ALLOWED_TURNSTILE_HOSTNAMES: readonly string[] = [
  "zanaris.rs",
  "www.zanaris.rs",
  "zanaris.vercel.app",
  "localhost",
  "127.0.0.1",
];

/**
 * Parse `ALLOWED_TURNSTILE_HOSTNAMES` — a comma-separated list.
 *
 * Unset or empty means the default list, not "allow anything": a variable
 * nobody remembered to set must not be the thing that switches the check off.
 * An entry may start `*.` to match any subdomain of what follows
 * (`*.vercel.app` matches `zanaris-git-main.vercel.app`, not `vercel.app`
 * itself), which is what a preview deployment needs.
 */
export function allowedHostnames(
  configured?: string | null,
): readonly string[] {
  const listed = (configured ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry !== "");

  return listed.length > 0 ? listed : DEFAULT_ALLOWED_TURNSTILE_HOSTNAMES;
}

/** Is `hostname` one of `allowed`? Case-insensitive; `*.` matches subdomains. */
export function hostnameAllowed(
  hostname: string,
  allowed: readonly string[],
): boolean {
  const host = hostname.trim().toLowerCase();
  if (host === "") return false;

  return allowed.some((entry) => {
    if (!entry.startsWith("*.")) return host === entry;
    const suffix = entry.slice(1); // "*.vercel.app" -> ".vercel.app"
    return host.endsWith(suffix) && host.length > suffix.length;
  });
}

export type TurnstileOptions = {
  readonly token: string | null | undefined;
  readonly secret: string | null | undefined;
  readonly remoteIp?: string | null;
  /** The action the token must carry. Defaults to `signup`. */
  readonly expectedAction?: string;
  /** Hostnames the challenge may have been solved on. Defaults to the list above. */
  readonly allowedHostnames?: readonly string[];
  /** Test seam. */
  readonly fetchImpl?: typeof fetch;
};

/** The three fields of the siteverify response this decision rests on. */
type SiteverifyResponse = {
  success?: unknown;
  action?: unknown;
  hostname?: unknown;
};

export async function verifyTurnstile({
  token,
  secret,
  remoteIp,
  expectedAction = TURNSTILE_ACTION,
  allowedHostnames: allowed = DEFAULT_ALLOWED_TURNSTILE_HOSTNAMES,
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

    const parsed: unknown = await response.json();
    if (typeof parsed !== "object" || parsed === null) return false;
    const result = parsed as SiteverifyResponse;

    if (result.success !== true) return false;

    // A token solved for some other purpose is not consent to make an account.
    if (typeof result.action !== "string" || result.action !== expectedAction) {
      return false;
    }

    // A token solved on somebody else's page is not ours to accept.
    if (
      typeof result.hostname !== "string" ||
      !hostnameAllowed(result.hostname, allowed)
    ) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}
