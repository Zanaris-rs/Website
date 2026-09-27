import "server-only";

import { query } from "@/lib/db";

import {
  type ClanListing,
  type ClanMember,
  type ClanNotice,
  type ClanOf,
  type ClanPage,
  clanDirectoryStatement,
  clanMembersStatement,
  clanNoticesStatement,
  clanOfStatement,
  clanPageStatement,
  parseClanDirectory,
  parseClanMembers,
  parseClanNotices,
  parseClanOf,
  parseClanPage,
} from "./queries";

/**
 * What the clan pages read, one query after another on the site's
 * two-connection pool: a clan by its slug with its roster and notices, a
 * player's clan for their card and Sheet tab, and the directory.
 */

export type LoadedClan = { clan: ClanPage; members: ClanMember[]; notices: ClanNotice[] };

/** A clan with its roster (rank, then joined) and newest notices; null for an unknown slug. */
export async function loadClan(slug: string): Promise<LoadedClan | null> {
  const page = clanPageStatement(slug);
  const clan = parseClanPage(await query<Record<string, unknown>>(page.text, page.values));
  if (!clan) return null;

  const roster = clanMembersStatement(clan.id);
  const members = parseClanMembers(await query<Record<string, unknown>>(roster.text, roster.values));
  const board = clanNoticesStatement(clan.id);
  const notices = parseClanNotices(await query<Record<string, unknown>>(board.text, board.values));
  return { clan, members, notices };
}

/**
 * A player's clan and rank, or null: in none, or unknown or banned. Forgiving,
 * as the log's Records read is - a card with no Clan row is better than no
 * card - so a failure is logged and read as none.
 */
export async function loadClanOf(name: string): Promise<ClanOf | null> {
  try {
    const wanted = clanOfStatement(name);
    return parseClanOf(await query<Record<string, unknown>>(wanted.text, wanted.values));
  } catch (error) {
    console.error("[clans] clan_of read failed", error);
    return null;
  }
}

/** Every clan with a visible member, largest first, then by name, at most 200. */
export async function loadClanDirectory(): Promise<ClanListing[]> {
  const wanted = clanDirectoryStatement();
  return parseClanDirectory(await query<Record<string, unknown>>(wanted.text, wanted.values));
}
