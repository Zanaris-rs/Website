import "server-only";

import type { Look } from "@/lib/chathead/look";
import { loadClanOf } from "@/lib/clans/page-data";
import type { ClanOf } from "@/lib/clans/queries";
import { query } from "@/lib/db";
import { toPlayerResponse, type PlayerSkill } from "@/lib/hiscores/api";
import { displayName } from "@/lib/hiscores/format";
import { DEFAULT_PROFILE } from "@/lib/hiscores/params";
import { playerQuery, type PlayerRow } from "@/lib/hiscores/queries";
import { gameLooks } from "@/lib/outfits/looks";
import { outfitsStatement, parseOutfits } from "@/lib/outfits/queries";

import { type Filter, FILTERS, filterOf, showsPosts, visibleFilters } from "./filters";
import { isPartHidden, readPart } from "./parts";
import { EMPTY_PERSONA, parsePersona, personaStatement, type Persona } from "./persona";
import { type LogHeader, logStatement, parseLog } from "./queries";
import { type LogRecord, parseRecords, recordsStatement } from "./records";
import { loadPinned, loadTimeline, type PinnedView, type TimelinePage } from "./view";
import { type WardrobeOutfit, wardrobeOf } from "./wardrobe";

/**
 * Everything a log page reads, one query after another on the site's
 * two-connection pool: the header (which also says whether there is a log to
 * show), the pinned update and the first page of the timeline under the
 * `?show=` filter, with their replies and chatheads, and
 * the player's hiscore levels, and their saved outfits for the Wardrobe. The
 * header's look is the default outfit; with none, it is the player's look
 * from the game, when the game has one. That look is never in the Wardrobe:
 * only outfits the player saved are, and every one of them is.
 *
 * Migration 015's Records read is its own try/catch, separate from the rest
 * of this function: a rehearsal or a prod database behind the migration
 * should still show the log, only without its Records box, rather than the
 * whole page failing on a function that doesn't exist yet. The owner's clan
 * (`loadClanOf`, migration 17) is forgiving the same way: a failed read is a
 * card with no Clan row.
 *
 * A part the owner hides (migration 18's `hidden_parts`, `parts.ts`) is not
 * read at all: each of those reads goes through `readPart`, the same gate the
 * timeline API uses. Adventures skips the pinned update and the timeline
 * (`first` is null, so the page draws no timeline), Wardrobe the outfits and
 * Records the records. About comes in the header's own row, so it is dropped
 * here, before anything draws it. Dialogue is still read: the figure says
 * the pages overhead without the box.
 */

export type LogPageData =
  | { result: "not_found" | "banned" }
  | {
      result: "ok";
      header: LogHeader & { result: "ok" };
      name: string;
      /** The filter `?show=` chose: Everything for none, or one this log has no button for. */
      show: Filter["slug"];
      /** The pinned update, when there is one and the filter shows updates. */
      pinned: PinnedView | null;
      /** The timeline's first page; null when the owner hides Adventures. */
      first: TimelinePage | null;
      skills: PlayerSkill[];
      outfits: WardrobeOutfit[];
      records: LogRecord[];
      persona: Persona;
      outfitLook: Look | null;
      /** The owner's clan and rank, for the card's Clan row; null for none. */
      clan: ClanOf | null;
    };

/**
 * The look a log's header draws: the default outfit, else the player's look
 * from the game cut down to their head (`gameLooks`), else nothing. The page
 * and its link preview both ask here, so a preview never shows more of the
 * player than the page does.
 */
export async function logLook(header: LogHeader & { result: "ok" }): Promise<Look | null> {
  return header.look ?? (await gameLooks([header.username])).get(header.username) ?? null;
}

export async function loadLogPage(
  username: string,
  viewer: string | null,
  show: string | null,
): Promise<LogPageData> {
  const headerStatement = logStatement(username, viewer);
  const header = parseLog(
    await query<Record<string, unknown>>(headerStatement.text, headerStatement.values),
  );
  if (header.result !== "ok") return { result: header.result };
  const look = await logLook(header);
  const { hiddenParts } = header;

  // A filter for kinds the owner hides has no button, so a link to one
  // (shared before they hid it) shows Everything rather than an empty list
  // with no button lit.
  const asked = filterOf(show);
  const filter = visibleFilters(header.hiddenCategories).includes(asked) ? asked : FILTERS[0];
  const pinned = showsPosts(filter)
    ? await readPart(hiddenParts, "adventures", () => loadPinned(username, viewer), null)
    : null;
  const first = await readPart(
    hiddenParts,
    "adventures",
    () => loadTimeline(username, viewer, null, filter.mask),
    null,
  );

  const hiscores = playerQuery({ profile: DEFAULT_PROFILE, username });
  const rows = await query<PlayerRow>(hiscores.text, hiscores.values);
  const skills = toPlayerResponse(username, rows, displayName).skills;

  // `accounts.outfits` is the owner's own list; the log page is already
  // behind `adventure_log`'s ban check, so reading it for anyone is the same
  // list the Wardrobe promises to show.
  const outfits = await readPart(
    hiddenParts,
    "wardrobe",
    async () => {
      const wanted = outfitsStatement(header.username);
      return wardrobeOf(parseOutfits(await query<Record<string, unknown>>(wanted.text, wanted.values)));
    },
    [],
  );

  const records = await readPart(
    hiddenParts,
    "records",
    async (): Promise<LogRecord[]> => {
      try {
        const wantedRecords = recordsStatement(header.username);
        return parseRecords(await query<Record<string, unknown>>(wantedRecords.text, wantedRecords.values));
      } catch (error) {
        console.error("[adventurer-log] records read failed", error);
        return [];
      }
    },
    [],
  );

  let persona = EMPTY_PERSONA;
  try {
    const wantedPersona = personaStatement(header.username);
    persona = parsePersona(await query<Record<string, unknown>>(wantedPersona.text, wantedPersona.values));
  } catch (error) {
    console.error("[adventurer-log] persona read failed", error);
  }

  const clan = await loadClanOf(header.username);

  return {
    result: "ok",
    header: { ...header, look, about: isPartHidden(hiddenParts, "about") ? "" : header.about },
    name: displayName(header.username),
    show: filter.slug,
    pinned,
    first,
    skills,
    outfits,
    records,
    persona,
    outfitLook: header.look,
    clan,
  };
}
