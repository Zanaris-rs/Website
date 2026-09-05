import { createHash, createHmac } from "node:crypto";

/**
 * The bcrypt salt, and the two things this site does with one.
 *
 * The site never sees a password hash. What it does see, and must see, is the
 * **salt**: `accounts.password_salt(name)` returns the 29-character prefix of
 * the stored hash so that the site can compute `bcrypt(lower(password), salt)`
 * and hand the candidate back for the database to compare. The salt is public
 * by design — it is stored in the clear next to every hash bcrypt ever made —
 * so returning it leaks nothing that a hash would not.
 *
 * Two derived values live here as well:
 *
 * - **`fakeSalt`**, the answer for a username that does not exist. Without it
 *   the login route is a username oracle: a real name costs a bcrypt (~60ms)
 *   and an unknown one costs nothing, and the difference is trivially timed.
 *   It is an HMAC of the name under `SESSION_SECRET`, so it is stable per name
 *   (a repeated probe cannot be told from a real account by watching it change)
 *   and unguessable without the secret.
 * - **`sessionVersion`**, the 16 hex characters of `sha256(salt)` carried in
 *   the session cookie. Changing a password changes the salt, so every cookie
 *   minted under the old one stops matching: one password change bounces every
 *   other device. It is a *fingerprint* of the salt and not the salt itself,
 *   because a cookie is readable by anyone holding it.
 */

/** `$2b$10$` + 22 characters of bcrypt-base64. Exactly 29 characters. */
export const BCRYPT_SALT_PATTERN = /^\$2[aby]\$[0-9]{2}\$[./A-Za-z0-9]{22}$/;

/** A whole hash: the salt above plus 31 more characters. Exactly 60. */
export const BCRYPT_HASH_PATTERN = /^\$2[aby]\$[0-9]{2}\$[./A-Za-z0-9]{53}$/;

export const BCRYPT_SALT_LENGTH = 29;
export const BCRYPT_HASH_LENGTH = 60;

export function isBcryptSalt(value: unknown): value is string {
  return typeof value === "string" && BCRYPT_SALT_PATTERN.test(value);
}

export function isBcryptHash(value: unknown): value is string {
  return typeof value === "string" && BCRYPT_HASH_PATTERN.test(value);
}

/**
 * The salt out of a whole hash — the same 29 characters `password_salt`
 * returns, for the tests that only have a hash to work from.
 *
 * `null` rather than a truncated string when the input is not a bcrypt hash:
 * feeding `hash()` a malformed salt throws deep inside the library, and a
 * caller that can see the `null` can take the fake-salt path instead.
 */
export function saltOf(hash: string): string | null {
  if (!BCRYPT_HASH_PATTERN.test(hash)) return null;
  return hash.slice(0, BCRYPT_SALT_LENGTH);
}

/**
 * bcrypt's own base64 alphabet, which is not the standard one: `.` and `/`
 * lead, and the digits come last.
 */
const BCRYPT_ALPHABET =
  "./ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

/**
 * Encode bytes the way bcrypt encodes a salt.
 *
 * This is OpenBSD's `encode_base64` verbatim in shape, and the shape matters:
 * 16 bytes become 22 characters, and the last character carries only the low
 * four bits of the last byte shifted up by two. Any other encoding produces a
 * string bcrypt will *decode* to the same 16 bytes but *re-encode* differently,
 * so the hash would not begin with the salt that was passed in — which is the
 * one property `fakeSalt` needs (see the test).
 */
export function bcryptBase64(bytes: Uint8Array): string {
  let out = "";
  let index = 0;

  while (index < bytes.length) {
    let c1 = bytes[index++];
    out += BCRYPT_ALPHABET[(c1 >> 2) & 0x3f];
    c1 = (c1 & 0x03) << 4;
    if (index >= bytes.length) {
      out += BCRYPT_ALPHABET[c1 & 0x3f];
      break;
    }

    let c2 = bytes[index++];
    c1 |= (c2 >> 4) & 0x0f;
    out += BCRYPT_ALPHABET[c1 & 0x3f];
    c1 = (c2 & 0x0f) << 2;
    if (index >= bytes.length) {
      out += BCRYPT_ALPHABET[c1 & 0x3f];
      break;
    }

    c2 = bytes[index++];
    c1 |= (c2 >> 6) & 0x03;
    out += BCRYPT_ALPHABET[c1 & 0x3f];
    out += BCRYPT_ALPHABET[c2 & 0x3f];
  }

  return out;
}

/** The cost the fake salt claims, so that it costs what a real one costs. */
const FAKE_SALT_COST = "10";

/**
 * A stable, unguessable salt for a username with no account.
 *
 * Deterministic in the username so that ten probes at `nosuchplayer` all get
 * the same answer, and keyed by `SESSION_SECRET` so that nobody can compute
 * the set of fake salts offline and compare. The cost is pinned at 10, which
 * is what every real account here uses (`lib/account/hash.ts`): a fake salt at
 * a different cost would take a visibly different amount of time.
 */
export function fakeSalt(secret: string, username: string): string {
  const digest = createHmac("sha256", secret)
    .update(`salt:${username}`)
    .digest();
  return `$2b$${FAKE_SALT_COST}$${bcryptBase64(digest.subarray(0, 16))}`;
}

/** How many hex characters of `sha256(salt)` the cookie carries. */
export const SESSION_VERSION_LENGTH = 16;

/**
 * The cookie's fingerprint of the current salt: 64 bits of `sha256(salt)`.
 *
 * Not the salt, because the cookie is not a secret. 64 bits is plenty for what
 * it does — detect that the salt has changed — and a collision would only fail
 * to log somebody out, which the seven-day expiry catches anyway.
 */
export function sessionVersion(salt: string): string {
  return createHash("sha256")
    .update(salt)
    .digest("hex")
    .slice(0, SESSION_VERSION_LENGTH);
}
