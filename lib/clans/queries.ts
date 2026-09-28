import type { Statement } from "@/lib/account/register";

import { asInt, asIso, asRecord, asText, oneOf } from "../adventurer-log/queries.ts";
import { type Perms, RANKS, type Rank } from "./ranks.ts";

/**
 * Every call into migration 17's clan functions, and the parsing of what
 * they answer: statements are `{ text, values }` with nothing interpolated,
 * and an answer nobody documented throws instead of being guessed at. Its
 * imports are relative, with extensions, so `scripts/db-check.mts` can load
 * it under node.
 */

export type ClanPage = {
  id: number;
  name: string;
  slug: string;
  motto: string;
  crest: number;
  world: number | null;
  about: string;
  createdAt: string;
  /** Members who are not banned. */
  members: number;
  /** Null when the Leader is banned. */
  leader: string | null;
  perms: Perms;
};

export type ClanMember = { username: string; rank: Rank; joinedAt: string };

export type ClanNotice = {
  id: number;
  title: string;
  body: string;
  author: string;
  /** Null when the author has left the clan. */
  authorRank: Rank | null;
  createdAt: string;
};

export type ClanOf = { clanId: number; name: string; slug: string; rank: Rank };

export type ClanInvite = {
  clanId: number;
  name: string;
  slug: string;
  motto: string;
  crest: number;
  members: number;
  invitedBy: string;
  invitedByRank: Rank | null;
  createdAt: string;
};

export type SentInvite = { username: string; invitedBy: string; createdAt: string };

export type ClanListing = { name: string; slug: string; motto: string; crest: number; members: number; createdAt: string };

// --- parsing ------------------------------------------------------------------------

function inRange(value: unknown, min: number, max: number, where: string): number {
  const n = asInt(value, where);
  if (n < min || n > max) throw new Error(`${where}: ${n} is not ${min}-${max}`);
  return n;
}

function rankOf(value: unknown, where: string): Rank {
  return oneOf(RANKS, value, where);
}

function rankOrNull(value: unknown, where: string): Rank | null {
  return value === null ? null : rankOf(value, where);
}

function textOrNull(value: unknown, where: string): string | null {
  return value === null ? null : asText(value, where);
}

function atMostOne(rows: readonly unknown[], where: string): Record<string, unknown> | null {
  if (rows.length === 0) return null;
  if (rows.length > 1) throw new Error(`${where} returned ${rows.length} rows; at most one`);
  return asRecord(rows[0], where);
}

const crestOf = (value: unknown, where: string) => inRange(value, 0, 65535, where);
const permOf = (value: unknown, where: string) => inRange(value, 0, 6, where);

// --- reads --------------------------------------------------------------------------

export function clanPageStatement(slug: string): Statement {
  return { text: "select * from accounts.clan_page($1)", values: [slug] };
}

export function parseClanPage(rows: readonly unknown[]): ClanPage | null {
  const row = atMostOne(rows, "clan_page");
  if (!row) return null;
  return {
    id: asInt(row.id, "clan_page id"),
    name: asText(row.name, "clan_page name"),
    slug: asText(row.slug, "clan_page slug"),
    motto: asText(row.motto, "clan_page motto"),
    crest: crestOf(row.crest, "clan_page crest"),
    world: row.world === null ? null : inRange(row.world, 1, 255, "clan_page world"),
    about: asText(row.about, "clan_page about"),
    createdAt: asIso(row.created_at, "clan_page created_at"),
    members: asInt(row.members, "clan_page members"),
    leader: textOrNull(row.leader, "clan_page leader"),
    perms: {
      invite: permOf(row.perm_invite, "clan_page perm_invite"),
      remove: permOf(row.perm_remove, "clan_page perm_remove"),
      ranks: permOf(row.perm_ranks, "clan_page perm_ranks"),
      page: permOf(row.perm_page, "clan_page perm_page"),
    },
  };
}

export function clanMembersStatement(clanId: number): Statement {
  return { text: "select * from accounts.clan_members($1)", values: [clanId] };
}

export function parseClanMembers(rows: readonly unknown[]): ClanMember[] {
  return rows.map((raw) => {
    const row = asRecord(raw, "clan_members");
    return {
      username: asText(row.username, "clan_members username"),
      rank: rankOf(row.rank, "clan_members rank"),
      joinedAt: asIso(row.joined_at, "clan_members joined_at"),
    };
  });
}

export function clanNoticesStatement(clanId: number): Statement {
  return { text: "select * from accounts.clan_notices($1)", values: [clanId] };
}

export function parseClanNotices(rows: readonly unknown[]): ClanNotice[] {
  return rows.map((raw) => {
    const row = asRecord(raw, "clan_notices");
    return {
      id: asInt(row.id, "clan_notices id"),
      title: asText(row.title, "clan_notices title"),
      body: asText(row.body, "clan_notices body"),
      author: asText(row.author, "clan_notices author"),
      authorRank: rankOrNull(row.author_rank, "clan_notices author_rank"),
      createdAt: asIso(row.created_at, "clan_notices created_at"),
    };
  });
}

export function clanDirectoryStatement(): Statement {
  return { text: "select * from accounts.clan_directory()", values: [] };
}

export function parseClanDirectory(rows: readonly unknown[]): ClanListing[] {
  return rows.map((raw) => {
    const row = asRecord(raw, "clan_directory");
    return {
      name: asText(row.name, "clan_directory name"),
      slug: asText(row.slug, "clan_directory slug"),
      motto: asText(row.motto, "clan_directory motto"),
      crest: crestOf(row.crest, "clan_directory crest"),
      members: asInt(row.members, "clan_directory members"),
      createdAt: asIso(row.created_at, "clan_directory created_at"),
    };
  });
}

export function clanOfStatement(name: string): Statement {
  return { text: "select * from accounts.clan_of($1)", values: [name] };
}

export function parseClanOf(rows: readonly unknown[]): ClanOf | null {
  const row = atMostOne(rows, "clan_of");
  if (!row) return null;
  return {
    clanId: asInt(row.clan_id, "clan_of clan_id"),
    name: asText(row.name, "clan_of name"),
    slug: asText(row.slug, "clan_of slug"),
    rank: rankOf(row.rank, "clan_of rank"),
  };
}

export function clanInvitesForStatement(username: string): Statement {
  return { text: "select * from accounts.clan_invites_for($1)", values: [username] };
}

export function parseClanInvitesFor(rows: readonly unknown[]): ClanInvite[] {
  return rows.map((raw) => {
    const row = asRecord(raw, "clan_invites_for");
    return {
      clanId: asInt(row.clan_id, "clan_invites_for clan_id"),
      name: asText(row.name, "clan_invites_for name"),
      slug: asText(row.slug, "clan_invites_for slug"),
      motto: asText(row.motto, "clan_invites_for motto"),
      crest: crestOf(row.crest, "clan_invites_for crest"),
      members: asInt(row.members, "clan_invites_for members"),
      invitedBy: asText(row.invited_by, "clan_invites_for invited_by"),
      invitedByRank: rankOrNull(row.invited_by_rank, "clan_invites_for invited_by_rank"),
      createdAt: asIso(row.created_at, "clan_invites_for created_at"),
    };
  });
}

export function clanInvitesSentStatement(username: string): Statement {
  return { text: "select * from accounts.clan_invites_sent($1)", values: [username] };
}

export function parseClanInvitesSent(rows: readonly unknown[]): SentInvite[] {
  return rows.map((raw) => {
    const row = asRecord(raw, "clan_invites_sent");
    return {
      username: asText(row.username, "clan_invites_sent username"),
      invitedBy: asText(row.invited_by, "clan_invites_sent invited_by"),
      createdAt: asIso(row.created_at, "clan_invites_sent created_at"),
    };
  });
}

// --- writes -------------------------------------------------------------------------

export function clanCreateStatement(
  username: string,
  name: string,
  motto: string,
  crest: number,
  world: number | null,
): Statement {
  return {
    text: "select accounts.clan_create($1, $2, $3, $4, $5) as result",
    values: [username, name, motto, crest, world],
  };
}

export function clanSavePageStatement(
  username: string,
  name: string,
  motto: string,
  crest: number,
  world: number | null,
  about: string,
): Statement {
  return {
    text: "select accounts.clan_save_page($1, $2, $3, $4, $5, $6) as result",
    values: [username, name, motto, crest, world, about],
  };
}

export function clanSetPermsStatement(
  username: string,
  invite: number,
  remove: number,
  ranks: number,
  page: number,
): Statement {
  return {
    text: "select accounts.clan_set_perms($1, $2, $3, $4, $5) as result",
    values: [username, invite, remove, ranks, page],
  };
}

export function clanInviteStatement(username: string, target: string): Statement {
  return { text: "select accounts.clan_invite($1, $2) as result", values: [username, target] };
}

export function clanInviteCancelStatement(username: string, target: string): Statement {
  return { text: "select accounts.clan_invite_cancel($1, $2) as result", values: [username, target] };
}

export function clanInviteAnswerStatement(username: string, clanId: number, accept: boolean): Statement {
  return { text: "select accounts.clan_invite_answer($1, $2, $3) as result", values: [username, clanId, accept] };
}

export function clanSetRankStatement(username: string, target: string, rank: Rank): Statement {
  return { text: "select accounts.clan_set_rank($1, $2, $3) as result", values: [username, target, rank] };
}

export function clanRemoveStatement(username: string, target: string): Statement {
  return { text: "select accounts.clan_remove($1, $2) as result", values: [username, target] };
}

export function clanLeaveStatement(username: string): Statement {
  return { text: "select accounts.clan_leave($1) as result", values: [username] };
}

export function clanHandOverStatement(username: string, target: string): Statement {
  return { text: "select accounts.clan_hand_over($1, $2) as result", values: [username, target] };
}

export function clanDisbandStatement(username: string): Statement {
  return { text: "select accounts.clan_disband($1) as result", values: [username] };
}

export function clanNoticePostStatement(username: string, title: string, body: string): Statement {
  return { text: "select accounts.clan_notice_post($1, $2, $3) as result", values: [username, title, body] };
}

export function clanNoticeDeleteStatement(username: string, id: number): Statement {
  return { text: "select accounts.clan_notice_delete($1, $2) as result", values: [username, id] };
}

// --- answers ------------------------------------------------------------------------

/** Every answer a clan write can give, across the thirteen functions. */
export const CLAN_WRITE_RESULTS = [
  "ok",
  "not_found",
  "banned",
  "muted",
  "not_member",
  "forbidden",
  "leader",
  "bad_name",
  "bad_motto",
  "bad_crest",
  "bad_world",
  "bad_about",
  "bad_perm",
  "bad_rank",
  "bad_title",
  "bad_body",
  "self",
  "no_such_player",
  "no_such_member",
  "no_invite",
  "no_notice",
  "taken",
  "in_clan",
  "already",
  "full",
  "too_many",
  "rate_limited",
] as const;

export type ClanWriteResult = (typeof CLAN_WRITE_RESULTS)[number];

export function parseClanWrite(raw: unknown, where: string): ClanWriteResult {
  return oneOf(CLAN_WRITE_RESULTS, raw, where);
}

/**
 * The request's shape is 400. The caller's standing (banned, muted, rank,
 * the Leader leaving, not in a clan) is 403. Nothing there is 404. A clash
 * with the clan's state (taken, in a clan, invited twice, full) is 409.
 * Too many is 429.
 */
export const CLAN_STATUS: Record<ClanWriteResult, number> = {
  ok: 200,
  bad_name: 400,
  bad_motto: 400,
  bad_crest: 400,
  bad_world: 400,
  bad_about: 400,
  bad_perm: 400,
  bad_rank: 400,
  bad_title: 400,
  bad_body: 400,
  self: 400,
  banned: 403,
  muted: 403,
  forbidden: 403,
  leader: 403,
  not_member: 403,
  not_found: 404,
  no_such_player: 404,
  no_such_member: 404,
  no_invite: 404,
  no_notice: 404,
  taken: 409,
  in_clan: 409,
  already: 409,
  full: 409,
  too_many: 409,
  rate_limited: 429,
};

export function clanStatusFor(result: string): number {
  return (CLAN_STATUS as Record<string, number>)[result] ?? 500;
}

/** What `runWrite` (lib/adventurer-log/route.ts) reads a clan write's answer with. */
export const CLAN_ANSWERS = { parse: parseClanWrite, status: clanStatusFor } as const;
