import "server-only";

import { hashPasswordWithSalt } from "@/lib/account/hash";
import { parseSalt, passwordSaltStatement } from "@/lib/account/login";
import { isBcryptHash, isBcryptSalt } from "@/lib/account/salt";
import { PASSWORD_MAX_TYPED } from "@/lib/account/validation";
import { query } from "@/lib/db";

/**
 * The password re-type, once, for every staff verb that needs one.
 *
 * The handshake is `app/api/staff/notice/route.ts`'s, and it is three steps:
 * `accounts.password_salt(actor)` returns the actor's own 29-character bcrypt
 * salt (public by design — the site never sees a hash), `bcrypt(lower(typed),
 * salt)` produces the candidate here, and the function compares it against the
 * stored hash inside the database. The compare *is* the authorisation: a
 * leaked `website` credential cannot resolve a report or lift a ban, because
 * it does not know the moderator's password.
 *
 * There is no fake-salt path, unlike the login route. The actor is the account
 * already signed in, so a missing salt is not an unknown username — it is a
 * dead session, and it says so.
 *
 * It returns a verdict rather than a `Response` so the routes keep their own
 * shape: `fail(code, status)` differs between them and the error vocabulary
 * belongs to the verb, not to the handshake.
 */
export type Candidate =
  | { readonly ok: true; readonly hash: string }
  | { readonly ok: false; readonly error: string; readonly status: number };

export async function candidateHash(
  actor: string,
  password: string,
): Promise<Candidate> {
  if (password.length < 1 || password.length > PASSWORD_MAX_TYPED) {
    return { ok: false, error: "bad_credentials", status: 403 };
  }

  const statement = passwordSaltStatement(actor);
  const rows = await query<{ salt: unknown }>(statement.text, statement.values);
  const stored = parseSalt(rows[0]?.salt);

  // No salt for an account that answered `accounts.profile` a moment ago means
  // the account has gone between the two calls.
  if (!isBcryptSalt(stored)) {
    console.warn("[staff] no usable salt for the actor's account");
    return { ok: false, error: "session_expired", status: 401 };
  }

  const hash = await hashPasswordWithSalt(password, stored);

  // The functions refuse anything that is not 60 characters, which would come
  // back as `bad_credentials` and read as a mistyped password. It would not
  // be: it would be this side broken, and it should say so.
  if (!isBcryptHash(hash)) {
    console.error("[staff] computed candidate is not a bcrypt hash");
    return { ok: false, error: "unavailable", status: 503 };
  }

  return { ok: true, hash };
}
