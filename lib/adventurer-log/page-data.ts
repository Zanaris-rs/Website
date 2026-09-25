import "server-only";

import type { Look } from "@/lib/chathead/look";
import { query } from "@/lib/db";
import { toPlayerResponse, type PlayerSkill } from "@/lib/hiscores/api";
import { displayName } from "@/lib/hiscores/format";
import { DEFAULT_PROFILE } from "@/lib/hiscores/params";
import { playerQuery, type PlayerRow } from "@/lib/hiscores/queries";
import { gameLooks } from "@/lib/outfits/looks";
import { outfitsStatement, parseOutfits } from "@/lib/outfits/queries";

import { type LogHeader, logStatement, parseLog } from "./queries";
import { loadTimeline, type TimelinePage } from "./view";
import { type WardrobeOutfit, wardrobeOf } from "./wardrobe";

/**
 * Everything a log page reads, one query after another on the site's
 * two-connection pool: the header (which also says whether there is a log to
 * show), the first page of the timeline with its replies and chatheads, and
 * the player's hiscore levels, and their saved outfits for the Wardrobe. The
 * header's look is the default outfit; with none, it is the player's look
 * from the game, when the game has one. That look is never in the Wardrobe:
 * only outfits the player saved are, and every one of them is.
 */

export type LogPageData =
  | { result: "not_found" | "banned" }
  | {
      result: "ok";
      header: LogHeader & { result: "ok" };
      name: string;
      first: TimelinePage;
      skills: PlayerSkill[];
      outfits: WardrobeOutfit[];
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

export async function loadLogPage(username: string, viewer: string | null): Promise<LogPageData> {
  const headerStatement = logStatement(username, viewer);
  const header = parseLog(
    await query<Record<string, unknown>>(headerStatement.text, headerStatement.values),
  );
  if (header.result !== "ok") return { result: header.result };
  const look = await logLook(header);

  const first = await loadTimeline(username, viewer, null);

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

  return {
    result: "ok",
    header: { ...header, look },
    name: displayName(header.username),
    first,
    skills,
    outfits,
  };
}
