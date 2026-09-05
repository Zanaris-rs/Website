import { createHmac, timingSafeEqual } from "node:crypto";

import { SESSION_VERSION_LENGTH } from "./salt";
import { CANONICAL_USERNAME_PATTERN } from "./validation";

/**
 * The website session: a signed cookie and nothing else.
 *
 * There is no session table. The cookie *is* the session — a JSON payload and
 * an HMAC-SHA256 of it under `SESSION_SECRET`, which is enough because the
 * only thing a session has to say is "this browser proved it knows the
 * password of this account". Everything else the account centre shows is read
 * from the database on every request, including `staffmodlevel`: the cookie is
 * never the authority on what somebody is allowed to do, only on who they are.
 *
 * Three properties are deliberate:
 *
 * - **`SESSION_SECRET` unset means nobody can log in.** A secret that defaults
 *   to something is a secret anybody can forge against, so the routes answer
 *   503 and the pages redirect. Failing closed is the only safe direction for
 *   a signature key.
 * - **`sv`, the salt fingerprint**, rides along so that changing a password
 *   invalidates every other cookie for the account. Stateless sessions cannot
 *   be revoked one by one; this revokes them all at once, which is what a
 *   password change is for.
 * - **Seven days, checked against `exp` in the payload as well as the cookie's
 *   own Max-Age.** A cookie's lifetime is a hint to a browser; the payload's
 *   is enforced here, where it cannot be edited.
 *
 * What this does not do is revoke a *captured* cookie before it expires:
 * logging out clears the browser's copy, and an attacker's copy keeps working
 * until `exp`. `HttpOnly` and seven days bound that. Swapping in a database of
 * live sessions later means changing `session-server.ts` and nothing else.
 */

export const SESSION_COOKIE = "zanaris_session";

/** Seven days, in seconds. Both the cookie's Max-Age and the payload's `exp`. */
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

/** The only payload version. A future shape gets a 2 and old cookies bounce. */
export const SESSION_VERSION = 1;

/** A secret shorter than this is not one. 32 hex characters is the minimum. */
export const SESSION_SECRET_MIN_LENGTH = 32;

export type Session = {
  readonly v: number;
  /** The canonical username, exactly as `public.account.username` holds it. */
  readonly u: string;
  /** `sessionVersion()` of the account's bcrypt salt when this was minted. */
  readonly sv: string;
  /** Issued at, and expires at: whole seconds since the epoch. */
  readonly iat: number;
  readonly exp: number;
};

/**
 * `SESSION_SECRET` if it is usable, `null` otherwise.
 *
 * A short secret is treated as no secret at all rather than as a weak one:
 * "logins mysteriously fail" is a bug someone fixes, and "logins work but the
 * cookie can be forged" is one nobody notices.
 */
export function sessionSecret(
  configured: string | null | undefined,
): string | null {
  const secret = (configured ?? "").trim();
  return secret.length >= SESSION_SECRET_MIN_LENGTH ? secret : null;
}

export function newSession(
  username: string,
  saltVersion: string,
  now: number = Date.now(),
): Session {
  const iat = Math.floor(now / 1000);
  return {
    v: SESSION_VERSION,
    u: username,
    sv: saltVersion,
    iat,
    exp: iat + SESSION_TTL_SECONDS,
  };
}

function base64url(value: Buffer): string {
  return value.toString("base64url");
}

function mac(secret: string, body: string): Buffer {
  return createHmac("sha256", secret).update(body).digest();
}

/** `<base64url payload>.<base64url HMAC>`. */
export function signSession(session: Session, secret: string): string {
  const body = base64url(Buffer.from(JSON.stringify(session), "utf8"));
  return `${body}.${base64url(mac(secret, body))}`;
}

function isSessionShape(value: unknown): value is Session {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.v === "number" &&
    typeof candidate.u === "string" &&
    typeof candidate.sv === "string" &&
    typeof candidate.iat === "number" &&
    typeof candidate.exp === "number"
  );
}

/**
 * The signed cookie back into a session, or `null`.
 *
 * Every rejection is the same `null`, on purpose: a caller that could tell
 * "expired" from "forged" would be a place to probe the secret from.
 *
 * The signature is compared with `timingSafeEqual` over the raw bytes. String
 * `===` on a MAC leaks how many leading bytes matched, which is the classic
 * way a forgery gets built one byte at a time.
 */
export function verifySession(
  token: string | null | undefined,
  secret: string | null | undefined,
  now: number = Date.now(),
): Session | null {
  if (!token || !secret) return null;

  // Split on the *last* dot: base64url contains no dots, so this is the
  // signature separator wherever the payload came from.
  const cut = token.lastIndexOf(".");
  if (cut <= 0 || cut === token.length - 1) return null;

  const body = token.slice(0, cut);
  const signature = Buffer.from(token.slice(cut + 1), "base64url");
  const expected = mac(secret, body);
  if (
    signature.length !== expected.length ||
    !timingSafeEqual(signature, expected)
  ) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (!isSessionShape(parsed)) return null;
  if (parsed.v !== SESSION_VERSION) return null;

  // A signed payload cannot have been edited, but it can have been minted by
  // an older, buggier version of this file — so the fields are checked anyway.
  if (!CANONICAL_USERNAME_PATTERN.test(parsed.u)) return null;
  if (!new RegExp(`^[0-9a-f]{${SESSION_VERSION_LENGTH}}$`).test(parsed.sv)) {
    return null;
  }

  const seconds = Math.floor(now / 1000);
  if (!Number.isFinite(parsed.exp) || parsed.exp <= seconds) return null;
  // A cookie that claims to outlive the TTL was not minted here.
  if (!Number.isFinite(parsed.iat) || parsed.exp - parsed.iat > SESSION_TTL_SECONDS) {
    return null;
  }

  return parsed;
}

/** What `cookies().set()` is given, minus the name and value. */
export type SessionCookieOptions = {
  readonly httpOnly: true;
  readonly secure: boolean;
  readonly sameSite: "lax";
  readonly path: "/";
  readonly maxAge: number;
};

/**
 * `HttpOnly` so script cannot read it, `Secure` off localhost, `SameSite=Lax`
 * so a cross-site POST arrives without it — which is what makes the mutating
 * routes' Origin check a belt to that brace — and **no `Domain`**, so the
 * cookie is host-only. Host-only is why `www.zanaris.rs` has to 308 to the
 * apex (see `next.config.ts`): otherwise a link to www would look signed out.
 */
export function sessionCookieOptions(secure: boolean): SessionCookieOptions {
  return {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  };
}

/** The same cookie with `Max-Age=0`: the browser drops it immediately. */
export function clearedSessionCookieOptions(
  secure: boolean,
): SessionCookieOptions {
  return { ...sessionCookieOptions(secure), maxAge: 0 };
}
