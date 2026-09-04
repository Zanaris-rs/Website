/**
 * The call into `accounts.register`, and the mapping from its answer to HTTP.
 *
 * Everything the gate actually enforces at write time lives inside that
 * function: the three rate caps, the account insert and the attempt row, in
 * one statement and therefore one implicit transaction. That matters on a
 * transaction pooler, where a multi-statement transaction from the app is not
 * reliably the same backend, and it means a malformed client cannot skip the
 * counting by calling things out of order.
 *
 * The order inside it is load-bearing: the attempt row is written **last**, so
 * the caps (3 per ip per 10 minutes, 10 per ip per day, 30 per /24 or /64 per
 * day) are charged for accounts created and not for calls made. A
 * `username_taken` or a `rate_limited` answer costs the caller nothing, so
 * three unlucky guesses at a free name cannot lock a player out.
 *
 * The `website` role has `EXECUTE` on this function and nothing else — no
 * `INSERT` on `account`, no `SELECT` on it either. The signature below is the
 * whole attack surface a leaked `DATABASE_URL` gets.
 */

export type RegisterInput = {
  /** Canonical, already through `validateUsername`. */
  readonly username: string;
  readonly email: string;
  readonly emailNormalized: string;
  /** bcrypt of the lower-cased password; the plaintext never leaves the route. */
  readonly passwordHash: string;
  readonly ip: string;
  readonly ipGroup: string;
  readonly agentHash: string;
};

export type RegisterResult = "ok" | "username_taken" | "rate_limited";

const RESULTS: ReadonlySet<string> = new Set([
  "ok",
  "username_taken",
  "rate_limited",
]);

export type Statement = {
  readonly text: string;
  readonly values: readonly unknown[];
};

export function registerStatement(input: RegisterInput): Statement {
  return {
    text: "select accounts.register($1, $2, $3, $4, $5, $6, $7) as result",
    values: [
      input.username,
      input.email,
      input.emailNormalized,
      input.passwordHash,
      input.ip,
      input.ipGroup,
      input.agentHash,
    ],
  };
}

/**
 * An unrecognised answer is a contract break, not a rejection: failing loudly
 * here is better than a 500 that reads like a database outage, or worse, a
 * silent success.
 */
export function parseRegisterResult(raw: unknown): RegisterResult {
  if (typeof raw === "string" && RESULTS.has(raw)) {
    return raw as RegisterResult;
  }
  throw new Error(`accounts.register returned ${JSON.stringify(raw)}`);
}

/** `ok` -> 200, `username_taken` -> 409, `rate_limited` -> 429. */
export function statusFor(result: RegisterResult): number {
  switch (result) {
    case "ok":
      return 200;
    case "username_taken":
      return 409;
    case "rate_limited":
      return 429;
  }
}
