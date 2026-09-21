/**
 * The running timer's arithmetic, apart from the component so it can be
 * tested with the clock passed in.
 *
 * The countdown runs against the database's clock, not the browser's. Every
 * read of `accounts.record_current` carries `server_now`; the page records how
 * far that was from its own clock when it arrived and applies the same offset
 * to every tick until the next read. A player whose computer is ten minutes
 * fast sees the same 4:59 as everybody else, and so does a second tab or a
 * phone - the timer is derived from `started_at`, which is stored, rather than
 * kept anywhere a refresh could lose it.
 */

/** Time left at which the page tells the player to get out of combat and log out. */
export const WARNING_SECONDS = 15;

/** How often the page re-reads `record_current` while the tab is visible. */
export const POLL_MS = 5_000;

/** Server time minus client time, measured when a read arrived. */
export function clockOffset(serverNowIso: string, clientNow: number): number {
  const server = Date.parse(serverNowIso);
  return Number.isFinite(server) ? server - clientNow : 0;
}

export type TimerPhase =
  /** Inside the window with more than WARNING_SECONDS left. */
  | "running"
  /** Inside the window, WARNING_SECONDS or fewer left. */
  | "warning"
  /** Past the window, inside the grace: a logout now still counts. */
  | "grace"
  /** Past the grace: whatever happens now, the attempt is over time. */
  | "over";

export type TimerView = {
  readonly phase: TimerPhase;
  /** Until the window closes; 0 once it has. */
  readonly leftMs: number;
  /** Until the grace runs out; 0 once it has. */
  readonly graceLeftMs: number;
};

export function timerAt(
  startedAtIso: string,
  durationSeconds: number,
  graceSeconds: number,
  offsetMs: number,
  clientNow: number,
): TimerView {
  const now = clientNow + offsetMs;
  const endsAt = Date.parse(startedAtIso) + durationSeconds * 1000;
  const graceEndsAt = endsAt + graceSeconds * 1000;

  const leftMs = Math.max(0, endsAt - now);
  const graceLeftMs = Math.max(0, graceEndsAt - now);

  let phase: TimerPhase;
  if (now < endsAt) {
    phase = leftMs <= WARNING_SECONDS * 1000 ? "warning" : "running";
  } else if (now <= graceEndsAt) {
    phase = "grace";
  } else {
    phase = "over";
  }

  return { phase, leftMs, graceLeftMs };
}

export type LogoutStanding = {
  /** Start to the logout: what Stop will measure. */
  readonly elapsedMs: number;
  /** Inside the duration plus its grace, so Stop will count it. */
  readonly inTime: boolean;
};

/**
 * Where a running attempt stands if the player has already logged out since
 * Start, or null if they have not (or are back in the game, when their next
 * logout will be the one that counts).
 *
 * The clock alone cannot tell a player who logged out at 5:04 and has not
 * pressed Stop yet from one still playing at 5:30. This can, from the logout
 * time the database already reports, so the page says "you made it - press
 * Stop" instead of warning a player who did everything right.
 */
export function logoutStanding(
  startedAtIso: string,
  durationSeconds: number,
  graceSeconds: number,
  presence: string,
  logoutTimeIso: string | null,
): LogoutStanding | null {
  if (presence === "logged_in" || logoutTimeIso === null) return null;

  const elapsedMs = Date.parse(logoutTimeIso) - Date.parse(startedAtIso);
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return null;

  return { elapsedMs, inTime: elapsedMs <= (durationSeconds + graceSeconds) * 1000 };
}

/**
 * The next poll, or null for none: every POLL_MS while the tab is visible, and
 * nothing while it is hidden. A hidden tab is a connection nobody is looking
 * at, and the pool behind the site is two connections per instance.
 */
export function pollDelay(hidden: boolean): number | null {
  return hidden ? null : POLL_MS;
}
