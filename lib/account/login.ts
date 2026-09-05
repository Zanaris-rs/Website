import type { Statement } from "./register";

/**
 * The four calls the login half of the site makes, and what their answers
 * mean in HTTP.
 *
 * Same shape as `lib/account/register.ts` and for the same reasons: the SQL is
 * built here so the tests can assert its exact text, every value is a
 * placeholder so nothing is ever interpolated, and each call is a single
 * statement because the transaction pooler gives no guarantee that two
 * statements from the app land on the same backend.
 *
 * The `website` role has `EXECUTE` on these four functions, `accounts.profile`
 * and `accounts.recent_logins`, and nothing else — no table privilege at all.
 * A leaked `DATABASE_URL` gets exactly this list of verbs: look up a salt,
 * offer a candidate hash, change a password or an email given the current one.
 * It cannot read a hash, read `login_attempt`, or clear the rate limit.
 *
 * The rate limit lives inside the functions, not here: `accounts.throttled`
 * counts **failures only** — 10 per username and 20 per IP in 15 minutes —
 * and is deliberately not granted to `website`, so the site can neither read
 * nor reset it.
 */

export type { Statement };

/**
 * The 29-character bcrypt prefix of the stored hash, or NULL for a username
 * with no account. The route turns that NULL into a `fakeSalt`, so the answer
 * costs the same either way.
 */
export function passwordSaltStatement(username: string): Statement {
  return {
    text: "select accounts.password_salt($1) as salt",
    values: [username],
  };
}

export function loginStatement(
  username: string,
  candidateHash: string,
  ip: string,
): Statement {
  return {
    text: "select accounts.login($1, $2, $3) as result",
    values: [username, candidateHash, ip],
  };
}

/**
 * Compare-and-set: the update only matches when `password` still equals the
 * candidate built from the *current* password. The site is not trusted to have
 * checked first, and a leaked session cookie cannot change a password without
 * the password.
 */
export function changePasswordStatement(
  username: string,
  currentCandidateHash: string,
  newHash: string,
  ip: string,
): Statement {
  return {
    text: "select accounts.change_password($1, $2, $3, $4) as result",
    values: [username, currentCandidateHash, newHash, ip],
  };
}

export function changeEmailStatement(
  username: string,
  currentCandidateHash: string,
  email: string,
  emailNormalized: string,
  ip: string,
): Statement {
  return {
    text: "select accounts.change_email($1, $2, $3, $4, $5) as result",
    values: [username, currentCandidateHash, email, emailNormalized, ip],
  };
}

/**
 * The salt out of the `password_salt` row.
 *
 * `null` for a missing row, a SQL NULL, or a stored hash too short to have a
 * salt in it. The caller cannot tell those apart and must not try: all three
 * take the fake-salt path, which is the whole no-oracle property.
 */
export function parseSalt(raw: unknown): string | null {
  return typeof raw === "string" && raw.length > 0 ? raw : null;
}

export type LoginResult = "ok" | "bad_credentials" | "rate_limited";

const RESULTS: ReadonlySet<string> = new Set([
  "ok",
  "bad_credentials",
  "rate_limited",
]);

/**
 * An unrecognised answer is a contract break, not a rejection. Throwing turns
 * it into a 503 the operator can find; returning `bad_credentials` would look
 * like every player suddenly typing the wrong password.
 */
export function parseLoginResult(raw: unknown): LoginResult {
  if (typeof raw === "string" && RESULTS.has(raw)) {
    return raw as LoginResult;
  }
  throw new Error(`accounts.login returned ${JSON.stringify(raw)}`);
}

/**
 * `ok` -> 200, `bad_credentials` -> 401, `rate_limited` -> 429.
 *
 * 401 for a bad password at the login form: nobody is authenticated yet.
 */
export function loginStatusFor(result: LoginResult): number {
  switch (result) {
    case "ok":
      return 200;
    case "bad_credentials":
      return 401;
    case "rate_limited":
      return 429;
  }
}

/**
 * The same answers from `change_password` / `change_email`, where the caller
 * **is** signed in: a wrong current password is a 403, not a 401, because 401
 * means "log in" and they already have.
 */
export function reauthStatusFor(result: LoginResult): number {
  switch (result) {
    case "ok":
      return 200;
    case "bad_credentials":
      return 403;
    case "rate_limited":
      return 429;
  }
}
