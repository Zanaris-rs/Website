/**
 * A clan's ranks: the game's clan-chat ladder, fixed, as levels from the
 * Leader (0) down to Recruit (6). A rank outranks another when its level is
 * lower. "Who can…" is a threshold per action, the lowest level allowed:
 * 0 is the Leader alone, 6 is every member. Migration 17 checks the same
 * numbers (`clan_rank_level`, `perm_*`); the site uses them only to show the
 * controls a member's rank allows, and the database refuses the rest.
 *
 * Pure and without imports: the tab, the pages, `lib/scenes/photo.ts` (run
 * by bun) and `scripts/db-check.mts` (run by node) all load it.
 */

export const RANKS = ["leader", "general", "captain", "lieutenant", "sergeant", "corporal", "recruit"] as const;
export type Rank = (typeof RANKS)[number];

export const RANK_NAMES: Record<Rank, string> = {
  leader: "Leader",
  general: "General",
  captain: "Captain",
  lieutenant: "Lieutenant",
  sergeant: "Sergeant",
  corporal: "Corporal",
  recruit: "Recruit",
};

export function isRank(value: unknown): value is Rank {
  return typeof value === "string" && (RANKS as readonly string[]).includes(value);
}

export function rankLevel(rank: Rank): number {
  return RANKS.indexOf(rank);
}

/** True when `a` is higher up the ladder than `b`. */
export function outranks(a: Rank, b: Rank): boolean {
  return rankLevel(a) < rankLevel(b);
}

export type PermKey = "invite" | "remove" | "ranks" | "page";
export type Perms = Record<PermKey, number>;

export const PERM_KEYS: readonly PermKey[] = ["invite", "remove", "ranks", "page"];

/** Sergeant and up invite, General and up remove and re-rank, Captain and up post and edit. */
export const DEFAULT_PERMS: Perms = { invite: 4, remove: 1, ranks: 1, page: 2 };

/** What a threshold of level `i` reads as, for the Leader's "Who can…" selects. */
export const PERM_LABELS: readonly string[] = [
  "Leader only",
  "General and above",
  "Captain and above",
  "Lieutenant and above",
  "Sergeant and above",
  "Corporal and above",
  "Every member",
];

/** What each threshold is for, as the Leader's form words it. */
export const PERM_ACTIONS: Record<PermKey, string> = {
  invite: "Invite players",
  remove: "Remove members",
  ranks: "Change ranks",
  page: "Post notices and edit the clan page",
};

export function may(key: PermKey, rank: Rank, perms: Perms): boolean {
  return rankLevel(rank) <= perms[key];
}

/** The ranks a member of `rank` may give: every one below their own. */
export function ranksBelow(rank: Rank): Rank[] {
  return RANKS.slice(rankLevel(rank) + 1);
}

export function youAre(rank: Rank): string {
  return rank === "leader" ? "You are the Leader" : `You are a ${RANK_NAMES[rank]}`;
}
