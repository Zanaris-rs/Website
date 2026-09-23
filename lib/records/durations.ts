/**
 * The record durations the site offers, and the grace after each.
 *
 * The database owns which durations exist - `accounts.record_durations()`,
 * three rows since engine migration 9 - and `record_start` refuses anything
 * else. This list owns the words. `npm run db:check` asserts the two agree, so
 * a duration added in SQL and not here (or the reverse) fails a script rather
 * than showing up as a board nobody can reach or a button the database
 * refuses.
 */

export type RecordDuration = {
  readonly seconds: number;
  /** How long after the window the final logout may land and still count. */
  readonly graceSeconds: number;
  /** "5 minutes", for sentences. */
  readonly label: string;
  /** "5-minute", before a noun: "the 5-minute board". */
  readonly adjective: string;
};

/**
 * Ten seconds of grace, engine migration 8's: the world's tick to act on a
 * logout, the hop to the login server, and combat's logout lock. Two seconds
 * was tried (Engine-TS#7, branch `records-grace-2s`) and shelved unapplied;
 * this number moves only when the database's does, or db:check fails.
 */
const FIVE_MINUTES: RecordDuration = { seconds: 300, graceSeconds: 10, label: "5 minutes", adjective: "5-minute" };
const SIX_HOURS: RecordDuration = { seconds: 21600, graceSeconds: 10, label: "6 hours", adjective: "6-hour" };
const TWENTY_FOUR_HOURS: RecordDuration = { seconds: 86400, graceSeconds: 10, label: "24 hours", adjective: "24-hour" };

/** Shortest first: the order the tabs and the Start buttons offer them in. */
export const RECORD_DURATIONS: readonly RecordDuration[] = [FIVE_MINUTES, SIX_HOURS, TWENTY_FOUR_HOURS];

/**
 * The board a bare `/hiscores/records` shows, and the duration the Start
 * buttons open on. Five minutes is offered to everyone and comes first because
 * it is the shortest, but it is the one short enough to test the whole flow
 * with rather than the headline - so the default is named here rather than
 * taken from the head of the list, where a shorter duration could displace it.
 */
export const DEFAULT_DURATION: RecordDuration = SIX_HOURS;

export function recordDuration(seconds: number): RecordDuration | null {
  return RECORD_DURATIONS.find((duration) => duration.seconds === seconds) ?? null;
}
