import type { Colour } from "@/lib/colour";
import { formatNumber } from "@/lib/hiscores/format";
import { formatShortDate } from "@/lib/news/parse";
import type { Punishment, PunishmentKind } from "@/lib/public/queries";

/**
 * The words /bans and /economy put round the rows.
 *
 * Nothing here is re-implemented: the dates come from `lib/account/profile.ts`
 * and the thousands separator from `lib/hiscores/format.ts`, both re-exported
 * rather than copied, because a second date format on a neighbouring page is a
 * bug the day one of them changes.
 *
 * The vocabulary is the owner's decision, written down: a punishment says who
 * issued it only as "a moderator" or "automated", and the record keeps rows
 * that have been lifted or have expired rather than hiding them. The point of
 * a permanent record is that it is permanent.
 */

export { formatWhen } from "@/lib/account/profile";
export { displayName, formatNumber } from "@/lib/hiscores/format";

/**
 * `8-Sep-2026`: the news list's date, which is the compact one the 2004 site
 * used in a table. /bans has two date columns in a 500px panel and cannot
 * afford "8 September 2026" twice; /economy uses it for the same reason.
 *
 * Null-safe, unlike `formatShortDate` itself — that one throws, because the
 * only thing it ever sees is a filename in this repo and a typo there should
 * fail the build. These dates come from a database, and one unreadable
 * timestamp should not take a page down.
 */
export function formatShortWhen(iso: string | null | undefined): string {
  if (!iso) return "unknown";
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return "unknown";
  return formatShortDate(when.toISOString().slice(0, 10));
}

/**
 * Where a page of the record lives: `/bans`, then `/bans/page/2`.
 *
 * The same shape as the news list (`listHref` in `lib/news/parse.ts`) and for
 * the same reason: page 1 has one URL, not two, so nothing has to decide which
 * of `/bans` and `/bans/page/1` is canonical.
 */
export function bansHref(page: number): string {
  return page <= 1 ? "/bans" : `/bans/page/${page}`;
}

const KIND_LABELS: Record<PunishmentKind, string> = {
  ban: "Ban",
  mute: "Mute",
};

export function punishmentKindLabel(kind: PunishmentKind): string {
  return KIND_LABELS[kind];
}

/**
 * Who issued it, in the only two forms this site will ever print.
 *
 * `public_punishments` does not return the issuer's account id or name, so
 * this is not a policy applied to a name we hold back — there is no name here
 * to hold back. The distinction that *is* public is whether a person decided
 * it, because that is the one a player appealing needs to know.
 */
export function issuerLabel(automated: boolean): string {
  return automated ? "Automated" : "A moderator";
}

/**
 * What is currently true about a punishment.
 *
 * Order matters: a lifted punishment is lifted whatever its end date said, and
 * a punishment with no end date is permanent rather than "active for a very
 * long time".
 */
export type PunishmentState = "lifted" | "expired" | "active" | "permanent";

export function punishmentState(
  punishment: Punishment,
  now: number = Date.now(),
): PunishmentState {
  if (punishment.liftedAt !== null) return "lifted";
  if (punishment.until === null) return "permanent";

  const until = new Date(punishment.until).getTime();
  if (!Number.isFinite(until)) return "permanent";
  return until > now ? "active" : "expired";
}

/** The "Ends" cell: when it ended, when it will, or that it will not. */
export function endsLabel(
  punishment: Punishment,
  now: number = Date.now(),
): string {
  switch (punishmentState(punishment, now)) {
    case "lifted":
      return `Lifted ${formatShortWhen(punishment.liftedAt)}`;
    case "permanent":
      return "Never";
    default:
      return formatShortWhen(punishment.until);
  }
}

/**
 * The colour of that cell.
 *
 * Red for something still in force, because that is the row a reader is
 * looking for; plain white for one that is over. Nothing is green: a lifted
 * ban is not good news, it is a correction.
 */
export function endsColour(
  punishment: Punishment,
  now: number = Date.now(),
): Colour | null {
  const state = punishmentState(punishment, now);
  return state === "active" || state === "permanent" ? "red" : null;
}

/**
 * "4 entered the game" / "1 left the game".
 *
 * The subject is the item, which the caller has already named, so this is the
 * predicate only — and it never says who, because nothing in the census knows
 * who. That is the whole design: totals are public, ownership is not.
 */
export function flowSentence(delta: number): string {
  const verb = delta > 0 ? "entered" : "left";
  return `${formatNumber(Math.abs(delta))} ${verb} the game`;
}

/** `+4` / `-1`, for a table cell that has a heading to say what it counts. */
export function signed(delta: number): string {
  return `${delta > 0 ? "+" : delta < 0 ? "−" : ""}${formatNumber(Math.abs(delta))}`;
}

/** The colour of a delta: entering is green, leaving is red, nothing is plain. */
export function flowColour(delta: number): Colour | null {
  if (delta > 0) return "green";
  if (delta < 0) return "red";
  return null;
}
