import "server-only";

import { type DirectoryEntry, loadDirectory } from "@/lib/adventurer-log/directory";
import { directoryStatement, parseDirectory } from "@/lib/adventurer-log/queries";
import type { Look } from "@/lib/chathead/look";
import { loadClanDirectory } from "@/lib/clans/page-data";
import type { ClanListing } from "@/lib/clans/queries";
import { query } from "@/lib/db";
import { toPlayerResponse } from "@/lib/hiscores/api";
import { OVERALL } from "@/lib/hiscores/categories";
import { displayName, xpFromValue } from "@/lib/hiscores/format";
import { DEFAULT_PROFILE } from "@/lib/hiscores/params";
import { playerQuery, type PlayerRow, tableQuery, type TableRow } from "@/lib/hiscores/queries";
import { chatheadLooks } from "@/lib/outfits/looks";
import { defaultLooksStatement, parseDefaultLooks } from "@/lib/outfits/queries";
import { RECORD_DURATIONS } from "@/lib/records/durations";
import { parseRecordBoardRow, recordBoardStatement } from "@/lib/records/queries";

import { exactCombat, pickSitters, SQUARE_READ, type SquareSitter } from "./square";

/**
 * What `/community` reads: the square, the top of the hiscores, the record
 * holders, the latest from the logs and the largest clans. No new SQL: each
 * is a read the site already makes elsewhere.
 *
 * Each box loads on its own and fails on its own, as the clan page's photo
 * does (`loadPhotoSitters`): a box's read that fails is logged and comes
 * back `{ ok: false }`, and the page says so in that box alone. A nicety
 * inside a box - a sitter's combat level, a row's chathead - is forgiving:
 * logged, and left out. The reads run one after another, on the site's
 * two-connection pool, as the log page's do.
 */

export type HubBox<T> = { ok: true; value: T } | { ok: false };

/** A row of Top of the hiscores: Overall, by rank. */
export type TopPlayer = { rank: number; username: string; name: string; totalLevel: number; look: Look | null };

/** A row of Record holders: a duration's #1 on the Overall board, or nobody yet. */
export type RecordHolder = {
  label: string;
  seconds: number;
  holder: { username: string; name: string; xp: number } | null;
};

export type Hub = {
  square: HubBox<SquareSitter[]>;
  top: HubBox<TopPlayer[]>;
  records: HubBox<RecordHolder[]>;
  recent: HubBox<DirectoryEntry[]>;
  clans: HubBox<ClanListing[]>;
};

/** How many rows Top of the hiscores, Recent activity and Clans show. */
export const HUB_TOP = 5;
export const HUB_RECENT = 5;
export const HUB_CLANS = 3;

async function box<T>(what: string, load: () => Promise<T>): Promise<HubBox<T>> {
  try {
    return { ok: true, value: await load() };
  } catch (error) {
    console.error(`[community] ${what} read failed`, error);
    return { ok: false };
  }
}

/**
 * A sitter's combat level, from the hiscores read the log's Skills box
 * makes: exact, or null for a range. Forgiving: a failed read is logged and
 * shows no level.
 */
async function combatOf(username: string): Promise<number | null> {
  try {
    const hiscores = playerQuery({ profile: DEFAULT_PROFILE, username });
    const rows = await query<PlayerRow>(hiscores.text, hiscores.values);
    return exactCombat(toPlayerResponse(username, rows, displayName).skills);
  } catch (error) {
    console.error("[community] a sitter's hiscores read failed", error);
    return null;
  }
}

/**
 * Who stands in the square, most recent first: the directory's ten most
 * recent logs, kept to those with a saved default outfit, five at most
 * (`pickSitters`), each with their greeting and combat level.
 */
export async function loadSquare(): Promise<SquareSitter[]> {
  const wanted = directoryStatement(null, SQUARE_READ);
  const { rows } = parseDirectory(await query<Record<string, unknown>>(wanted.text, wanted.values), SQUARE_READ);
  if (rows.length === 0) return [];

  const outfits = defaultLooksStatement(rows.map((row) => row.username));
  const looks = parseDefaultLooks(await query<Record<string, unknown>>(outfits.text, outfits.values));
  const sitters: SquareSitter[] = [];
  for (const { row, look } of pickSitters(rows, looks)) {
    sitters.push({
      username: row.username,
      name: displayName(row.username),
      look,
      greeting: row.greeting,
      greetingColour: row.greetingColour,
      greetingEffect: row.greetingEffect,
      combat: await combatOf(row.username),
    });
  }
  return sitters;
}

/** Chatheads for a box's rows: a nicety, so a failed read is logged and draws empty frames. */
async function lookupLooks(usernames: readonly string[]): Promise<Map<string, Look>> {
  try {
    return await chatheadLooks(usernames);
  } catch (error) {
    console.error("[community] chatheads read failed", error);
    return new Map();
  }
}

/** Ranks 1-5 on Overall: the hiscores table's top selection, its first five rows. */
export async function loadTopPlayers(): Promise<TopPlayer[]> {
  const table = tableQuery({ profile: DEFAULT_PROFILE, category: OVERALL, selection: { kind: "top" } });
  const rows = (await query<TableRow>(table.text, table.values)).slice(0, HUB_TOP);
  const looks = await lookupLooks(rows.map((row) => row.username));
  return rows.map((row) => ({
    rank: row.rank,
    username: row.username,
    name: displayName(row.username),
    totalLevel: row.level,
    look: looks.get(row.username) ?? null,
  }));
}

/** The #1 on each duration's Overall record board, shortest first. */
export async function loadRecordHolders(): Promise<RecordHolder[]> {
  const holders: RecordHolder[] = [];
  for (const duration of RECORD_DURATIONS) {
    const board = recordBoardStatement(duration.seconds, OVERALL, 1);
    const [first] = await query<Record<string, unknown>>(board.text, board.values);
    const row = first === undefined ? null : parseRecordBoardRow(first);
    holders.push({
      label: duration.label,
      seconds: duration.seconds,
      holder: row && { username: row.username, name: displayName(row.username), xp: xpFromValue(row.gainedValue) },
    });
  }
  return holders;
}

/** The directory's five most recent, as its own rows. */
export async function loadRecentActivity(): Promise<DirectoryEntry[]> {
  return (await loadDirectory(null, HUB_RECENT)).entries;
}

/** The three largest clans, as `/clans` lists them. */
export async function loadHubClans(): Promise<ClanListing[]> {
  return (await loadClanDirectory()).slice(0, HUB_CLANS);
}

/** Every box on the hub, each on its own. */
export async function loadHub(): Promise<Hub> {
  const square = await box("square", loadSquare);
  const top = await box("top of the hiscores", loadTopPlayers);
  const records = await box("record holders", loadRecordHolders);
  const recent = await box("recent activity", loadRecentActivity);
  const clans = await box("clans", loadHubClans);
  return { square, top, records, recent, clans };
}

/** The signed-in reader's own chathead, for Your log: forgiving, as the other chatheads are. */
export async function loadYourLook(username: string): Promise<Look | null> {
  return (await lookupLooks([username])).get(username) ?? null;
}
