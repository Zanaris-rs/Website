import "server-only";

import { query } from "@/lib/db";
import { toPlayerResponse, type PlayerSkill } from "@/lib/hiscores/api";
import { displayName } from "@/lib/hiscores/format";
import { DEFAULT_PROFILE } from "@/lib/hiscores/params";
import { playerQuery, type PlayerRow } from "@/lib/hiscores/queries";

import { type LogHeader, logStatement, parseLog } from "./queries";
import { loadTimeline, type TimelinePage } from "./view";

/**
 * Everything a log page reads, one query after another on the site's
 * two-connection pool: the header (which also says whether there is a log to
 * show), the first page of the timeline with its replies and chatheads, and
 * the player's hiscore levels.
 */
export type LogPageData =
  | { result: "not_found" | "banned" }
  | {
      result: "ok";
      header: LogHeader & { result: "ok" };
      name: string;
      first: TimelinePage;
      skills: PlayerSkill[];
    };

export async function loadLogPage(username: string, viewer: string | null): Promise<LogPageData> {
  const headerStatement = logStatement(username, viewer);
  const header = parseLog(
    await query<Record<string, unknown>>(headerStatement.text, headerStatement.values),
  );
  if (header.result !== "ok") return { result: header.result };

  const first = await loadTimeline(username, viewer, null);

  const hiscores = playerQuery({ profile: DEFAULT_PROFILE, username });
  const rows = await query<PlayerRow>(hiscores.text, hiscores.values);
  const skills = toPlayerResponse(username, rows, displayName).skills;

  return { result: "ok", header, name: displayName(header.username), first, skills };
}
