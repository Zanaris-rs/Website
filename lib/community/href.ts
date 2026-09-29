import type { TitleBoxLink } from "@/components/site/TitleBox";
import { CHARACTER_HREF, CLAN_TAB_HREF, DIRECTORY_HREF, LOG_SETTINGS_HREF, logHref } from "@/lib/adventurer-log/href";
import { CLANS_HREF } from "@/lib/clans/href";
import { BOARD_PATH, SET_RECORD_HREF } from "@/lib/records/api";

/**
 * The community pages - the hub, the hiscores, the record board, the
 * Adventurer Logs and the clans - are one part of the site, so each one's
 * title box carries the same bar (`communityLinks`): Main menu - Community -
 * Hiscores - Records - Adventurer Logs - Clans. The page you are on is plain
 * text (`TitleBoxLink.current`); on a player's log none is, since a log is
 * no one section's page.
 *
 * A signed-in player gets a second row on the directory and on their own
 * log (`yourLogLinks`): their log and the pages it is written from.
 *
 * `TitleBoxLink` is imported as a type only, so nothing of the component is
 * loaded from here; `lib/` stays free of component code.
 */

export const COMMUNITY_HREF = "/community";

/** The hiscores table. Its links elsewhere carry a category (`tableHref`); the bar's and the hub's do not. */
export const HISCORES_HREF = "/hiscores";

export type CommunitySection = "community" | "hiscores" | "records" | "logs" | "clans";

/** The bar, in order. */
const SECTIONS: readonly { section: CommunitySection; href: string; text: string }[] = [
  { section: "community", href: COMMUNITY_HREF, text: "Community" },
  { section: "hiscores", href: HISCORES_HREF, text: "Hiscores" },
  { section: "records", href: BOARD_PATH, text: "Records" },
  { section: "logs", href: DIRECTORY_HREF, text: "Adventurer Logs" },
  { section: "clans", href: CLANS_HREF, text: "Clans" },
];

/**
 * How wide a title box with the bar is: the bar on one line from a tablet up,
 * wrapping only on a phone. `TitleBox`'s default, `--title-max`, is for a box
 * with one or two links.
 */
export const COMMUNITY_BAR_WIDTH = "min(460px, 100%)";

/** The bar's links for a title box, `current` the page it is on (null on a player's log). */
export function communityLinks(current: CommunitySection | null): TitleBoxLink[] {
  return SECTIONS.map(({ section, href, text }) => ({ href, text, current: section === current }));
}

/**
 * A signed-in player's "Your log:" row: View (left out on their own log,
 * which they are reading), Character, Clan, Records (their own Start/Stop
 * page) and Log settings. `me` is their stored name.
 */
export function yourLogLinks(me: string, onOwnLog: boolean): TitleBoxLink[] {
  return [
    ...(onOwnLog ? [] : [{ href: logHref(me), text: "View" }]),
    { href: CHARACTER_HREF, text: "Character" },
    { href: CLAN_TAB_HREF, text: "Clan" },
    { href: SET_RECORD_HREF, text: "Records" },
    { href: LOG_SETTINGS_HREF, text: "Log settings" },
  ];
}
