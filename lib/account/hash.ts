import { compare, hash } from "bcrypt-ts";

/**
 * The password-hash contract, shared with the engine:
 *
 *     bcrypt(password.toLowerCase(), cost 10)
 *
 * Both halves matter and both are easy to get wrong in a way that only shows
 * up at login, far from here:
 *
 * - **`toLowerCase()`** because the 2004 login protocol is case-insensitive.
 *   A player who registers `Hunter2` types `hunter2` in the client and must
 *   still get in.
 * - **Cost 10, bcrypt, not pgcrypto.** The plaintext never reaches Postgres;
 *   `accounts.register` takes an already-computed hash, so the database never
 *   has to stay byte-compatible with this library.
 *
 * `hash.test.ts` verifies a committed fixture from the engine side, which is
 * the only cheap way to catch a drift before an account is created that can
 * never log in.
 */

export const BCRYPT_COST = 10;

export function hashPassword(password: string): Promise<string> {
  return hash(password.toLowerCase(), BCRYPT_COST);
}

export function verifyPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  return compare(password.toLowerCase(), storedHash);
}
