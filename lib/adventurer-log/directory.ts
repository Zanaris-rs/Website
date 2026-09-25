import "server-only";

import type { Look } from "@/lib/chathead/look";
import { query } from "@/lib/db";
import { displayName } from "@/lib/hiscores/format";
import { chatheadLooks } from "@/lib/outfits/looks";

import { activityOf } from "./activity";
import type { EventIcon } from "./events";
import { DIRECTORY_PAGE, type DirectoryCursor, directoryCursorOf, directoryStatement, parseDirectory } from "./queries";

/**
 * A page of `/adventurer-log`, the directory of recently active logs, ready
 * to draw: each log's name, headline, chathead and the latest thing it shows
 * the public, newest first.
 */

export type DirectoryEntry = {
  username: string;
  name: string;
  headline: string;
  at: string;
  /** The adventure's picture (a skill, an item); null for an update or none. */
  icon: EventIcon;
  /** The adventure as the log words it, or "Posted an update: ..." */
  activity: string;
  look: Look | null;
};

export type DirectoryPage = { entries: DirectoryEntry[]; next: DirectoryCursor | null };

/** `limit` is the page's length: the directory's own, or `/title`'s few. */
export async function loadDirectory(
  before: DirectoryCursor | null,
  limit: number = DIRECTORY_PAGE,
): Promise<DirectoryPage> {
  const statement = directoryStatement(before, limit);
  const page = parseDirectory(await query<Record<string, unknown>>(statement.text, statement.values), limit);
  const looks = await chatheadLooks(page.rows.map((row) => row.username));

  const entries = page.rows.map(
    (row): DirectoryEntry => ({
      username: row.username,
      name: displayName(row.username),
      headline: row.headline,
      at: row.lastAt,
      ...activityOf(row),
      look: looks.get(row.username) ?? null,
    }),
  );
  const last = page.rows[page.rows.length - 1];
  return { entries, next: page.more && last ? directoryCursorOf(last) : null };
}
