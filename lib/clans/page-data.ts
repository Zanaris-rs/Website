import "server-only";

import { parsePersona, personaStatement } from "@/lib/adventurer-log/persona";
import type { Look } from "@/lib/chathead/look";
import { query } from "@/lib/db";
import { defaultLooksStatement, parseDefaultLooks } from "@/lib/outfits/queries";

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
import type { Rank } from "./ranks";

/**
 * What the clan pages read, one query after another on the site's
 * two-connection pool: a clan by its slug with its roster and notices, who
 * stands in its photo, a player's clan for their card and Sheet tab, and the
 * directory.
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
 * A player's clan and rank, or null: in none, or unknown or banned. Strict: a
 * failed read throws, for a page that says "unavailable" rather than "not in
 * a clan" (the owner's Sheet).
 */
export async function readClanOf(name: string): Promise<ClanOf | null> {
  const wanted = clanOfStatement(name);
  return parseClanOf(await query<Record<string, unknown>>(wanted.text, wanted.values));
}

/**
 * `readClanOf`, forgiving, as the log's Records read is - a card with no Clan
 * row is better than no card - so a failure is logged and read as none.
 */
export async function loadClanOf(name: string): Promise<ClanOf | null> {
  try {
    return await readClanOf(name);
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

export type PhotoSitter = { username: string; rank: Rank; look: Look };

/**
 * Who can stand in the clan photo, and where the Leader stands.
 * - **The sitters:** every member with a saved outfit, from
 *   `outfit_default_looks`, since only a saved outfit is ever drawn whole: a
 *   member with none is left out, never drawn in a look from the game. They
 *   come in the roster's order (rank, then joined); the page keeps as many as
 *   the spot has slots (`photoSitters`).
 * - **The scene:** the Leader's persona scene. The page stands the photo
 *   there if it has slots, else in Varrock square (`photoSpot`).
 *
 * The persona read is forgiving (a failure is logged and read as no scene);
 * the outfits read throws, for the page to catch.
 */
export async function loadPhotoSitters(
  leader: string | null,
  members: readonly ClanMember[],
): Promise<{ leaderScene: string | null; sitters: PhotoSitter[] }> {
  let leaderScene: string | null = null;
  if (leader) {
    try {
      const persona = personaStatement(leader);
      leaderScene = parsePersona(await query<Record<string, unknown>>(persona.text, persona.values)).scene;
    } catch (error) {
      console.error("[clans] the Leader's persona read failed", error);
    }
  }
  if (members.length === 0) return { leaderScene, sitters: [] };

  const wanted = defaultLooksStatement(members.map((member) => member.username));
  const looks = parseDefaultLooks(await query<Record<string, unknown>>(wanted.text, wanted.values));
  const sitters = members.flatMap((member) => {
    const look = looks.get(member.username);
    return look ? [{ username: member.username, rank: member.rank, look }] : [];
  });
  return { leaderScene, sitters };
}
