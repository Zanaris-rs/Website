import { INVALID_NAME, toSafeName } from "@/lib/base37";

/**
 * Username and password rules for registration.
 *
 * Pure and total. The username rules have to agree with the engine, because
 * the name a player types here is the name they will type at the login screen:
 * anything base37 cannot encode is not an account the game can ever address.
 */

/** What the register form's field accepts before canonicalisation. */
export const USERNAME_PATTERN = /^[A-Za-z0-9_ ]{1,12}$/;

/**
 * What a name looks like *after* canonicalisation, which is what the database
 * holds and what the session cookie carries: base37 emits nothing but
 * lower-case letters, digits and underscores.
 */
export const CANONICAL_USERNAME_PATTERN = /^[a-z0-9_]{1,12}$/;

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 20;

/**
 * The most a *login* form will even look at.
 *
 * Logging in must not apply the 8-20 registration rule: an account made before
 * that rule existed, or by staff, may hold a password outside it and still has
 * to open. This is only a bound on how much text is worth running bcrypt over
 * — bcrypt itself stops at 72 bytes — so that a multi-megabyte body cannot be
 * used to make the server work.
 */
export const PASSWORD_MAX_TYPED = 128;

/**
 * Reserved outright. `mod_` is handled separately as a prefix, since that is
 * the shape the real impersonations take (`mod_ash`, `mod_gerhard`).
 */
const RESERVED = new Set([
  "jagex",
  "admin",
  "moderator",
  "owner",
  "system",
  "staff",
  "jmod",
  "pmod",
]);

const RESERVED_PREFIX = "mod_";

export type UsernameError =
  | "username_format"
  | "username_unencodable"
  | "username_reserved";

export type PasswordError =
  | "password_short"
  | "password_long"
  | "password_charset";

export type Validated<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

/**
 * Canonicalise a typed username into the name that will be stored.
 *
 * The round trip through base37 is the whole point: `Bob Smith` becomes
 * `bob_smith` and `bob_` becomes `bob`, so the caller must show the result
 * before the player commits to it.
 */
export function canonicalizeUsername(
  raw: string,
): Validated<string, UsernameError> {
  const trimmed = raw.trim();
  if (!USERNAME_PATTERN.test(trimmed)) {
    return { ok: false, error: "username_format" };
  }

  const username = toSafeName(trimmed);
  if (username === INVALID_NAME) {
    // e.g. "_" or "   ": passes the character class, encodes to nothing.
    return { ok: false, error: "username_unencodable" };
  }

  return { ok: true, value: username };
}

/**
 * Canonicalise **and** refuse the reserved names. This is the registration
 * rule; logging in uses `canonicalizeUsername` above.
 *
 * The split matters: `mod_ash` is a name nobody may create, and also the name
 * of a real staff account that has to be able to sign in. A single function
 * doing both jobs locks the staff out of their own account centre.
 */
export function validateUsername(
  raw: string,
): Validated<string, UsernameError> {
  const canonical = canonicalizeUsername(raw);
  if (!canonical.ok) return canonical;

  const username = canonical.value;
  if (RESERVED.has(username) || username.startsWith(RESERVED_PREFIX)) {
    return { ok: false, error: "username_reserved" };
  }

  return { ok: true, value: username };
}

/**
 * Passwords are 8-20 printable ASCII.
 *
 * The upper bound and the charset are protocol limits, not policy: the 2004
 * login screen cannot send anything longer or anything outside this range, so
 * accepting one here would create an account nobody can log into. Case is not
 * checked because it is not kept — see `lib/account/hash.ts`.
 */
export function validatePassword(raw: string): Validated<string, PasswordError> {
  if (raw.length < PASSWORD_MIN) return { ok: false, error: "password_short" };
  if (raw.length > PASSWORD_MAX) return { ok: false, error: "password_long" };
  if (!/^[\x20-\x7e]+$/.test(raw)) {
    return { ok: false, error: "password_charset" };
  }
  return { ok: true, value: raw };
}
