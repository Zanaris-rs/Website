import { formatDay, formatWhen } from "@/lib/account/profile";
import { formatNumber } from "@/lib/hiscores/format";
import { LAUNCHED } from "@/lib/site";

import {
  ECONOMY_SPAWN_ROW_LIMIT,
  type EconomyWindow,
  type StaffSpawn,
  type StaffSpawnTotal,
} from "./queries";

/**
 * What staff have created, and how much of the table the answer covers.
 *
 * `total` is the aggregate and `spawns` the rows, which are two reads of one
 * table through two functions, so either can fail without the other. What
 * neither of them carries is **which** read the rows came from, and that is
 * what `allTime` is for: `public_staff_spawns_all()` and
 * `public_staff_spawns(90)` return the same four columns, so a list of rows on
 * its own cannot say whether it is the whole history or a window of it.
 *
 * It was inferred from `total` once — rows were treated as all-time exactly
 * when the aggregate had come back. That is a different question with the same
 * answer most of the time, and the times it differs are the bad ones: the
 * aggregate failing on its own left every row in hand labelled "the last 90
 * days", under a five-hundred-row warning belonging to a function that had not
 * been called.
 */
export type SpawnRecord = {
  /** The all-time aggregate, or `null` when that read did not come back. */
  readonly total: StaffSpawnTotal | null;
  /** The rows to list, or `null` when no read came back. */
  readonly spawns: readonly StaffSpawn[] | null;
  /** Whether `spawns` is the whole table rather than the newest window of it. */
  readonly allTime: boolean;
};

/**
 * The one figure on /economy that is supposed to stay at nought.
 *
 * Everything else on the page is a number that moves and means nothing on its
 * own. This one is a claim: that nobody running the server has conjured an item
 * into the economy. An empty four-column table made that claim by showing
 * nothing, which reads as a page that failed rather than as a promise kept, so
 * the nought is the headline now and the table is the evidence behind it.
 *
 * Which means the difference between "nought" and "we could not tell" has to be
 * exact here, more than anywhere else on the site. There are three answers and
 * they are not interchangeable:
 *
 * - **Ever.** The whole table was read, by `public_staff_spawn_total()` or by
 *   `public_staff_spawns_all()` or both. This is the claim the page wants to
 *   make and the only one that is really "ever".
 * - **This window.** Neither all-time read came back, so the page falls back to
 *   `public_staff_spawns(90)` and *says ninety days*, because ninety days is
 *   all it actually looked at.
 * - **Nothing.** No read came back. The page says so and prints no figure,
 *   rather than printing the nought it would like to be true.
 */
export type SpawnClaim = {
  /** The figure, or `null` when nothing could be read. */
  readonly items: number | null;
  /** What the figure counts, as the label under it. */
  readonly label: string;
  /**
   * The line under the label, qualifying it. Never null: the page prints this
   * and has nothing of its own to say, so a claim that does not qualify itself
   * leaves the space to be filled by a guess.
   */
  readonly detail: string;
  /** Whether this is the whole table rather than a window of it. */
  readonly allTime: boolean;
};

const EVER = "items ever created by staff";

/** "1 item", "2 items". */
function plural(n: number, one: string): string {
  return `${formatNumber(n)} ${n === 1 ? one : `${one}s`}`;
}

/**
 * "Nothing, ever" is a claim about a stretch of time, and without saying which
 * stretch it is a claim about nothing — a log started yesterday would carry the
 * same sentence.
 */
function sinceTheStart(): string {
  return `The server opened on ${formatDay(LAUNCHED)} and the log began the same day. Nothing has been created by staff since.`;
}

function sum(spawns: readonly StaffSpawn[]): number {
  return spawns.reduce((total, row) => total + row.count, 0);
}

export function staffSpawnClaim(
  record: SpawnRecord,
  window: EconomyWindow,
): SpawnClaim {
  const { total, spawns, allTime } = record;

  if (total !== null) {
    return {
      items: total.items,
      label: EVER,
      allTime: true,
      detail:
        total.spawns === 0
          ? sinceTheStart()
          : `${plural(total.spawns, "record")}, the first ${formatWhen(total.firstAt)}.`,
    };
  }

  // The aggregate is gone but the rows are all of them, so the scope of the
  // claim survives and only the tidy pre-summed figure does not. Counting the
  // rows is the same arithmetic the function would have done.
  if (allTime && spawns !== null) {
    return {
      items: sum(spawns),
      label: EVER,
      allTime: true,
      detail:
        spawns.length === 0
          ? sinceTheStart()
          : // Newest first, so the oldest row is the last one.
            `${plural(spawns.length, "record")}, the first ${formatWhen(spawns[spawns.length - 1].createdAt)}.`,
    };
  }

  const label = `items created by staff in ${window.label}`;

  if (spawns === null) {
    return {
      items: null,
      label,
      allTime: false,
      detail: "This could not be read just now.",
    };
  }

  // The windowed function stops at five hundred rows and says nothing about it,
  // so a list exactly that long is a list with an unknown amount behind it. The
  // sum is then a floor rather than a total, and has to be printed as one.
  if (spawns.length >= ECONOMY_SPAWN_ROW_LIMIT) {
    return {
      items: sum(spawns),
      label,
      allTime: false,
      detail: `More than one read returns: this is at least ${plural(ECONOMY_SPAWN_ROW_LIMIT, "record")}, and there may be older ones.`,
    };
  }

  return {
    items: sum(spawns),
    label,
    allTime: false,
    // Both of these name the window. An unqualified "nothing has been created
    // by staff" under a ninety-day figure reads as the all-time claim, which is
    // the one sentence this whole file exists to not say by accident.
    detail:
      spawns.length === 0
        ? `Nothing has been created by staff in ${window.label}.`
        : `${plural(spawns.length, "record")} in ${window.label}.`,
  };
}
