/**
 * The call into `accounts.register_with_invite`, and the mapping from its
 * answer to HTTP. It claims a single-use invite in the same statement that
 * creates the account.
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
 * The `website` role has `EXECUTE` on this function and nothing else — this
 * is the only way it can create an account. The signature below is the whole
 * attack surface a leaked `DATABASE_URL` gets.
 */

export type RegisterInput = {
  /** Normalised, already through `normalizeInviteCode`. */
  readonly code: string;
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

export type RegisterResult =
  | "ok"
  | "invite_invalid"
  | "invite_claimed"
  | "invite_expired"
  | "invite_revoked"
  | "username_taken"
  | "rate_limited";

const RESULTS: ReadonlySet<string> = new Set([
  "ok",
  "invite_invalid",
  "invite_claimed",
  "invite_expired",
  "invite_revoked",
  "username_taken",
  "rate_limited",
]);

export type Statement = {
  readonly text: string;
  readonly values: readonly unknown[];
};

export function registerStatement(input: RegisterInput): Statement {
  return {
    text: "select * from accounts.register_with_invite($1, $2, $3, $4, $5, $6, $7, $8)",
    values: [
      input.code,
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

export type Registered = {
  readonly result: RegisterResult;
  /** `account.id`, for `ok` only. */
  readonly citizenNumber: number | null;
};

/**
 * An unrecognised answer is a contract break, not a rejection: failing loudly
 * here is better than a 500 that reads like a database outage, or worse, a
 * silent success. An `ok` without a number is the same kind of break.
 */
export function parseRegisterRow(row: unknown): Registered {
  const record =
    typeof row === "object" && row !== null
      ? (row as Record<string, unknown>)
      : null;
  const raw = record?.result;
  if (typeof raw !== "string" || !RESULTS.has(raw)) {
    throw new Error(`accounts.register_with_invite returned ${JSON.stringify(raw)}`);
  }
  const result = raw as RegisterResult;
  if (result !== "ok") return { result, citizenNumber: null };

  const number = record?.citizen_number;
  if (typeof number !== "number" || !Number.isInteger(number) || number < 1) {
    throw new Error("accounts.register_with_invite returned ok without a number");
  }
  return { result, citizenNumber: number };
}

/** `ok` 200; anything about the link or the name 409; the caps 429. */
export function statusFor(result: RegisterResult): number {
  switch (result) {
    case "ok":
      return 200;
    case "rate_limited":
      return 429;
    default:
      return 409;
  }
}
