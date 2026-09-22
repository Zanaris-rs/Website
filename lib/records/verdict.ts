import type { RecordDuration } from "./durations";
import { formatElapsed, formatGain, ordinal } from "./format";
import type { Presence, RecordReason, RecordState } from "./queries";

/**
 * Everything the records pages say, as data.
 *
 * Telling a player exactly why an attempt did not count is the feature, not a
 * courtesy, so every code the SQL can answer has a sentence here and
 * `verdict.test.ts` fails if one is added without one. Where the fault is
 * ours, the copy says so first.
 */

// --- before Start -------------------------------------------------------------

/** The two buttons, named once: the buttons wear these and the rules name them. */
export const START_LABEL = "Start record";
export const STOP_LABEL = "Stop record";

/** A line of the rules: text, with the buttons it names picked out. */
export type RuleLine = readonly (string | { readonly button: string })[];

/**
 * What to do, in order. The grace is not here on purpose: it is there to
 * absorb the world acting on a logout, the login server writing it down and
 * combat's logout lock, not something to aim for. 0:00 is the line.
 */
export const RULE_STEPS: readonly RuleLine[] = [
  ["Log out of the game and enter your username and password ready to begin your record."],
  ["Press ", { button: START_LABEL }, " and log into the game and begin your record."],
  ["YOU must log out before the timer reaches 0:00."],
  ["Press ", { button: STOP_LABEL }, " before you log in again."],
];

/** What the time measures, under the steps. */
export const RULE_TIMING: RuleLine = [
  "Your record time runs from pressing ",
  { button: START_LABEL },
  " to your last logout. The seconds it takes to log in count too. The time it takes to press ",
  { button: STOP_LABEL },
  " does not count.",
];

/** A rule line as plain text, for tests and anything without markup. */
export function ruleText(line: RuleLine): string {
  return line.map((part) => (typeof part === "string" ? part : part.button)).join("");
}

/**
 * Why this account can never start a record, or null if it can. Cosmetic:
 * `accounts.record_start` refuses both on its own. Read from the profile row
 * the request loaded, never from the cookie.
 */
export function blockedFrom(
  profile: { readonly staffModLevel: number; readonly bannedUntil: string | null },
  now: number = Date.now(),
): "staff" | "banned" | null {
  if (profile.staffModLevel > 1) return "staff";
  if (profile.bannedUntil !== null && Date.parse(profile.bannedUntil) > now) return "banned";
  return null;
}

// --- where the player is ------------------------------------------------------

export const PRESENCE_LINES: Record<Presence, string> = {
  logged_in: "You're logged in to the game.",
  syncing: "Logged out ✓ — syncing your stats…",
  logged_out: "You're logged out ✓",
  never: "We have no logout on record for you yet. Log in and out once, then come back.",
};

// --- refusals -----------------------------------------------------------------

/**
 * One sentence per error code any record route can answer: the SQL results
 * that refuse, plus the route's own (`session_expired`, `origin`,
 * `unavailable`).
 */
export const MESSAGES: Record<string, string> = {
  logged_in: "The game says you're still logged in. Log out with the logout button, then try again.",
  syncing: "Logged out ✓ — syncing your stats… try again in a few seconds.",
  already_running: "You already have a record running.",
  not_running: "You don't have a record running.",
  no_hiscore: "We don't have your stats yet. Log in and out once, then try again.",
  staff: "Staff accounts aren't on the hiscores, so they can't set records.",
  banned: "Banned accounts aren't on the hiscores, so they can't set records.",
  unknown_duration: "That isn't a record we run.",
  too_many: "You've started twelve records in the last hour. Take a break and try again soon.",
  not_found: "We couldn't find your account. Log in again.",
  session_expired: "You are signed out. Log in again.",
  origin: "That request did not come from this site. Reload the page.",
  unavailable: "Records are unavailable right now. Try again shortly.",
};

export function messageFor(code: string): string {
  return MESSAGES[code] ?? MESSAGES.unavailable;
}

// --- how an attempt finished -------------------------------------------------------

/** `good` published, `bad` the player's, `ours` our failure, `neutral` nobody's. */
export type Tone = "good" | "bad" | "ours" | "neutral";

export type Verdict = {
  readonly tone: Tone;
  readonly title: string;
  readonly lines: readonly string[];
};

export type FinishedAttempt = {
  readonly state: Exclude<RecordState, "running">;
  readonly reason: RecordReason | null;
  readonly elapsedMs: number | null;
  /** Overall, raw x10. */
  readonly gainedValue: number | null;
  readonly boardRank: number | null;
};

/**
 * Every `(state, reason)` pair migration 8 can store, spelled out. The test
 * walks this list, so a pair the SQL grows without copy here fails vitest
 * rather than rendering an empty panel.
 */
export const FINISHES: readonly (readonly [FinishedAttempt["state"], RecordReason | null])[] = [
  ["valid", null],
  ["rejected", "over_time"],
  ["rejected", "no_session"],
  ["void", "no_clean_logout"],
  ["abandoned", "player"],
  ["abandoned", "not_stopped"],
];

export function verdictFor(attempt: FinishedAttempt, duration: RecordDuration): Verdict {
  const took = attempt.elapsedMs === null ? null : formatElapsed(attempt.elapsedMs);
  const window = formatElapsed(duration.seconds * 1000);
  const gained = attempt.gainedValue ?? 0;

  switch (`${attempt.state}:${attempt.reason ?? ""}`) {
    case "valid:":
      if (gained <= 0) {
        return {
          tone: "neutral",
          title: "No XP gained",
          lines: [
            `You were logged in and out inside the window${took ? ` (${took})` : ""}, but the server read the same XP at the end as at the start. Nothing to put on the board.`,
          ],
        };
      }
      return {
        tone: "good",
        title: `${formatGain(gained)} XP in ${took ?? window}`,
        lines: [
          attempt.boardRank === null
            ? `This counts as a ${duration.adjective} record.`
            : `You're ${ordinal(attempt.boardRank)} on the ${duration.adjective} Overall board.`,
        ],
      };

    case "rejected:over_time":
      return {
        tone: "bad",
        title: gained > 0 ? `Over time: ${formatGain(gained)} XP in ${took}` : `Over time: ${took}`,
        lines: [
          `You logged out at ${took} — past the ${window} window and its ${duration.graceSeconds}-second grace.`,
          "This attempt isn't a record. It's on your history, and nowhere else.",
        ],
      };

    case "rejected:no_session":
      return {
        tone: "bad",
        title: "Nothing to measure",
        lines: [
          "You didn't log in and out during this attempt, so there's nothing to measure. Nothing was published.",
        ],
      };

    case "void:no_clean_logout":
      return {
        tone: "ours",
        title: "This attempt doesn't count — and that's on us",
        lines: [
          "Your session didn't end with a normal logout (the world may have restarted), so we can't vouch for the stats behind it.",
          "It doesn't count against your starts. Nothing was published.",
        ],
      };

    case "abandoned:player":
      return {
        tone: "neutral",
        title: "You cancelled this attempt",
        lines: ["Nothing was published. It still counts towards your twelve starts an hour."],
      };

    case "abandoned:not_stopped":
      return {
        tone: "bad",
        title: "Never stopped",
        lines: [
          `${STOP_LABEL} wasn't pressed within an hour of the window, so this attempt closed without a result. Press ${STOP_LABEL} as soon as you've logged out.`,
        ],
      };

    default:
      throw new Error(`no copy for ${attempt.state}/${attempt.reason}`);
  }
}

/** A short label for the history table. */
export const HISTORY_LABELS: Record<string, string> = {
  "running:": "Running",
  "valid:": "Record",
  "rejected:over_time": "Over time",
  "rejected:no_session": "Nothing measured",
  "void:no_clean_logout": "Void (our fault)",
  "abandoned:player": "Cancelled",
  "abandoned:not_stopped": "Never stopped",
};

export function historyLabel(state: RecordState, reason: RecordReason | null): string {
  return HISTORY_LABELS[`${state}:${reason ?? ""}`] ?? state;
}
