/**
 * The record durations the site offers, and the grace after each.
 *
 * The database owns which durations exist - `accounts.record_durations()` in
 * engine migration 8 - and `record_start` refuses anything else. This list
 * owns the words. `npm run db:check` asserts the two agree, so a duration added
 * in SQL and not here (or the reverse) fails a script rather than showing up
 * as a board nobody can reach or a button the database refuses.
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

export const RECORD_DURATIONS: readonly RecordDuration[] = [
  { seconds: 300, graceSeconds: 10, label: "5 minutes", adjective: "5-minute" },
];

export const DEFAULT_DURATION: RecordDuration = RECORD_DURATIONS[0];

export function recordDuration(seconds: number): RecordDuration | null {
  return RECORD_DURATIONS.find((duration) => duration.seconds === seconds) ?? null;
}
