import "server-only";

import type { Look } from "@/lib/chathead/look";
import { query } from "@/lib/db";
import { toPlayerResponse, type PlayerSkill } from "@/lib/hiscores/api";
import { displayName } from "@/lib/hiscores/format";
import { DEFAULT_PROFILE } from "@/lib/hiscores/params";
import { playerQuery, type PlayerRow } from "@/lib/hiscores/queries";
import { gameLooks } from "@/lib/outfits/looks";
import { outfitsStatement, parseOutfits } from "@/lib/outfits/queries";

import { type Filter, FILTERS, filterOf, showsPosts, visibleFilters } from "./filters";
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
 * whole page failing on a function that doesn't exist yet.
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
      first: TimelinePage;
      skills: PlayerSkill[];
      outfits: WardrobeOutfit[];
      records: LogRecord[];
      persona: Persona;
      outfitLook: Look | null;
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

  // A filter for kinds the owner hides has no button, so a link to one
  // (shared before they hid it) shows Everything rather than an empty list
  // with no button lit.
  const asked = filterOf(show);
  const filter = visibleFilters(header.hiddenCategories).includes(asked) ? asked : FILTERS[0];
  const pinned = showsPosts(filter) ? await loadPinned(username, viewer) : null;
  const first = await loadTimeline(username, viewer, null, filter.mask);

  const hiscores = playerQuery({ profile: DEFAULT_PROFILE, username });
  const rows = await query<PlayerRow>(hiscores.text, hiscores.values);
  const skills = toPlayerResponse(username, rows, displayName).skills;

  // `accounts.outfits` is the owner's own list; the log page is already
  // behind `adventure_log`'s ban check, so reading it for anyone is the same
  // list the Wardrobe promises to show.
  const wanted = outfitsStatement(header.username);
  const outfits = wardrobeOf(
    parseOutfits(await query<Record<string, unknown>>(wanted.text, wanted.values)),
  );

  let records: LogRecord[] = [];
  try {
    const wantedRecords = recordsStatement(header.username);
    records = parseRecords(
      await query<Record<string, unknown>>(wantedRecords.text, wantedRecords.values),
    );
  } catch (error) {
    console.error("[adventurer-log] records read failed", error);
  }

  let persona = EMPTY_PERSONA;
  try {
    const wantedPersona = personaStatement(header.username);
    persona = parsePersona(await query<Record<string, unknown>>(wantedPersona.text, wantedPersona.values));
  } catch (error) {
    console.error("[adventurer-log] persona read failed", error);
  }

  return {
    result: "ok",
    header: { ...header, look },
    name: displayName(header.username),
    show: filter.slug,
    pinned,
    first,
    skills,
    outfits,
    records,
    persona,
    outfitLook: header.look,
  };
}
