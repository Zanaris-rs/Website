import type { Statement } from "./register";

/**
 * What the account centre reads, and how it is put into words.
 *
 * Two `STABLE SECURITY DEFINER` functions, both keyed by the username out of
 * the signed session cookie — never by an id the browser could supply, and
 * never by anything the page passes through from a query string. `website` has
 * `EXECUTE` on both and `SELECT` on none of the tables behind them, so this is
 * the entire read surface: one account's own row, and one account's own recent
 * logins.
 *
 * The parsing and the wording live here, away from the components, because
 * they are the part that has to be right: a page that says "Banned until" with
 * the wrong date, or that quietly shows an expired ban as a live one, is worse
 * than a page that says nothing.
 */

export type { Statement };

/**
 * The world profile the fleet runs. `engine/src/util/WorldConfig.ts` defaults
 * `node.profile` to `main` and `NODE_PROFILE` is not set anywhere on the
 * fleet, so every `session` and `account_login` row carries this. It is a
 * parameter of both SQL functions rather than a literal inside them, so a
 * second profile later is a constant change here.
 */
export const GAME_PROFILE = "main";

/** How many recent logins the account centre lists. The SQL clamps to 1..20. */
export const RECENT_LOGINS = 10;

export function profileStatement(
  username: string,
  profile: string = GAME_PROFILE,
): Statement {
  return {
    text: "select * from accounts.profile($1, $2)",
    values: [username, profile],
  };
}

export function recentLoginsStatement(
  username: string,
  profile: string = GAME_PROFILE,
  limit: number = RECENT_LOGINS,
): Statement {
  return {
    text: "select * from accounts.recent_logins($1, $2, $3)",
    values: [username, profile, limit],
  };
}

/** One account, as the page needs it: dates as ISO strings, nothing else. */
export type Profile = {
  readonly username: string;
  readonly email: string;
  readonly members: boolean;
  readonly staffModLevel: number;
  readonly registrationDate: string | null;
  readonly mutedUntil: string | null;
  readonly bannedUntil: string | null;
  readonly playableAfter: string | null;
  /** The current bcrypt salt, for `sessionVersion`. Never rendered. */
  readonly salt: string;
  /** The world id the account is online on right now; 0 when it is not. */
  readonly loggedIn: number;
  readonly loginTime: string | null;
  /** The world id it last logged out of. */
  readonly loggedOut: number;
  readonly logoutTime: string | null;
};

export type RecentLogin = {
  readonly world: number;
  readonly loggedInAt: string | null;
  readonly ip: string | null;
};

/**
 * `pg` hands back `timestamptz` as a `Date`, and everything downstream wants a
 * string it can format or compare. Anything else — a NULL, a column the
 * function stopped returning — becomes `null` rather than `"Invalid Date"`.
 */
function asIso(value: unknown): string | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  if (typeof value === "string" && value !== "") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  return null;
}

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/**
 * One row of `accounts.profile`, or `null` when there is none.
 *
 * No row means the account was deleted (or renamed) while a cookie for it was
 * still valid. The page treats that as signed out, which is the only honest
 * answer: there is nothing to show.
 */
export function parseProfileRow(row: unknown): Profile | null {
  if (typeof row !== "object" || row === null) return null;
  const r = row as Record<string, unknown>;
  if (typeof r.username !== "string" || r.username === "") return null;

  return {
    username: r.username,
    email: typeof r.email === "string" ? r.email : "",
    members: r.members === true,
    staffModLevel: asNumber(r.staffmodlevel),
    registrationDate: asIso(r.registration_date),
    mutedUntil: asIso(r.muted_until),
    bannedUntil: asIso(r.banned_until),
    playableAfter: asIso(r.playable_after),
    salt: typeof r.salt === "string" ? r.salt : "",
    loggedIn: asNumber(r.logged_in),
    loginTime: asIso(r.login_time),
    loggedOut: asNumber(r.logged_out),
    logoutTime: asIso(r.logout_time),
  };
}

export function parseRecentLogin(row: unknown): RecentLogin | null {
  if (typeof row !== "object" || row === null) return null;
  const r = row as Record<string, unknown>;
  return {
    world: asNumber(r.world),
    loggedInAt: asIso(r.logged_in_at),
    ip: typeof r.ip === "string" && r.ip !== "" ? r.ip : null,
  };
}

/** A line the account centre prints about the state of the account. */
export type StatusNotice = {
  readonly kind: "banned" | "muted" | "soaking";
  readonly text: string;
  /** `red` for a ban, `yellow` for the two lesser states. */
  readonly colour: "red" | "yellow";
};

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/**
 * Everything on these pages is UTC and British-shaped: `5 September 2026`.
 *
 * Assembled by hand rather than with `toLocaleString`, for two reasons. The
 * pages are server-rendered, so "the reader's locale" would in practice be the
 * server's, and a date that differs between the render and the hydration is a
 * React mismatch. And `en-GB` itself is not stable across ICU versions — the
 * separator between the date and the time changed from `,` to ` at ` — so a
 * locale call would make the output depend on which Node built the page.
 */
export function formatDay(iso: string | null | undefined): string {
  if (!iso) return "unknown";
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return "unknown";

  return `${when.getUTCDate()} ${MONTHS[when.getUTCMonth()]} ${when.getUTCFullYear()}`;
}

/** The same, plus the 24-hour time: `5 September 2026, 11:00 UTC`. */
export function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "unknown";
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return "unknown";

  const hours = String(when.getUTCHours()).padStart(2, "0");
  const minutes = String(when.getUTCMinutes()).padStart(2, "0");
  return `${formatDay(iso)}, ${hours}:${minutes} UTC`;
}

function future(iso: string | null, now: number): boolean {
  if (!iso) return false;
  const when = new Date(iso).getTime();
  return Number.isFinite(when) && when > now;
}

/**
 * What is currently true about the account, in the order it matters.
 *
 * Only *live* restrictions are listed: an expired ban is not a ban, and
 * showing one would have players writing in about a punishment that ended
 * three weeks ago. `playable_after` is the engine's soak timer on a fresh
 * account, which is not a punishment at all and is worded accordingly.
 *
 * A banned account can still sign in here — that is deliberate, and Part 3 is
 * the reason: the Message Centre is exactly where somebody who cannot play
 * needs to be able to read why and reply.
 */
export function accountStatus(
  profile: Profile,
  now: number = Date.now(),
): StatusNotice[] {
  const notices: StatusNotice[] = [];

  if (future(profile.bannedUntil, now)) {
    notices.push({
      kind: "banned",
      colour: "red",
      text: `Banned until ${formatWhen(profile.bannedUntil)}. You cannot log in to the game until then.`,
    });
  }

  if (future(profile.mutedUntil, now)) {
    notices.push({
      kind: "muted",
      colour: "yellow",
      text: `Muted until ${formatWhen(profile.mutedUntil)}. You can play, but other players cannot see your public chat.`,
    });
  }

  if (future(profile.playableAfter, now)) {
    notices.push({
      kind: "soaking",
      colour: "yellow",
      text: `Playable from ${formatWhen(profile.playableAfter)}.`,
    });
  }

  return notices;
}

/** "Currently online on World 1 since …" / "Last logged out … (World 1)". */
export function presenceLine(profile: Profile): string | null {
  if (profile.loggedIn !== 0) {
    return profile.loginTime
      ? `Currently online on World ${profile.loggedIn} since ${formatWhen(profile.loginTime)}.`
      : `Currently online on World ${profile.loggedIn}.`;
  }

  if (profile.logoutTime) {
    return profile.loggedOut !== 0
      ? `Last logged out ${formatWhen(profile.logoutTime)} (World ${profile.loggedOut}).`
      : `Last logged out ${formatWhen(profile.logoutTime)}.`;
  }

  return null;
}
