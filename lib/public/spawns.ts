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
 * - **Ever.** `public_staff_spawn_total()` read the whole table. This is the
 *   claim the page wants to make and the only one that is really "ever".
 * - **This window.** That function is not there yet — it lands by hand at a
 *   psql prompt, after the deploy — so the page falls back to the windowed read
 *   and *says ninety days*, because ninety days is all it actually looked at.
 * - **Nothing.** Neither read came back. The page says so and prints no figure,
 *   rather than printing the nought it would like to be true.
 */
export type SpawnClaim = {
  /** The figure, or `null` when nothing could be read. */
  readonly items: number | null;
  /** What the figure counts, as the label under it. */
  readonly label: string;
  /** The line under the label, qualifying it, or nothing to add. */
  readonly detail: string | null;
  /** Whether this is the whole table rather than a window of it. */
  readonly allTime: boolean;
};

/** "1 item", "2 items". */
function plural(n: number, one: string): string {
  return `${formatNumber(n)} ${n === 1 ? one : `${one}s`}`;
}

export function staffSpawnClaim(
  total: StaffSpawnTotal | null,
  spawns: readonly StaffSpawn[] | null,
  window: EconomyWindow,
): SpawnClaim {
  if (total !== null) {
    return {
      items: total.items,
      label: "items ever created by staff",
      allTime: true,
      detail:
        total.spawns === 0
          ? // The date is the point. "Nothing, ever" is a claim about a stretch
            // of time, and without saying which stretch it is a claim about
            // nothing — a log started yesterday would carry the same sentence.
            `The server opened on ${formatDay(LAUNCHED)} and the log began the same day. Nothing has been created by staff since.`
          : `${plural(total.spawns, "record")}, the first ${formatWhen(total.firstAt)}.`,
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
  const cut = spawns.length >= ECONOMY_SPAWN_ROW_LIMIT;

  return {
    items: spawns.reduce((sum, row) => sum + row.count, 0),
    label,
    allTime: false,
    detail: cut
      ? `More than one read returns: this is at least ${plural(ECONOMY_SPAWN_ROW_LIMIT, "record")}, and there may be older ones.`
      : null,
  };
}
