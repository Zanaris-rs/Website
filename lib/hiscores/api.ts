import { xpFromValue } from "./format";
import type { TableParams } from "./params";
import type { PlayerRow, TableRow } from "./queries";

/**
 * The JSON contract between the hiscores routes and the pages, in both
 * directions: the shapers the route uses to turn database rows into a
 * response, and the parsers the client uses to validate one coming back.
 *
 * Same discipline as `lib/worlds.ts` — a malformed body throws, and the caller
 * turns that into a "hiscores unavailable" state rather than rendering junk.
 */

export type HiscoreRow = {
  /** 1-based position in the category. */
  rank: number;
  /** Stored form, e.g. `the_inducted`. Player links use this. */
  username: string;
  /** Display form, e.g. `The Inducted`. */
  name: string;
  level: number;
  xp: number;
};

export type HiscoresResponse = {
  profile: string;
  category: number;
  rows: HiscoreRow[];
  /** Username of the row to highlight, or `null` for a plain top-of-table. */
  highlight: string | null;
};

export type PlayerSkill = {
  category: number;
  rank: number;
  level: number;
  xp: number;
};

export type PlayerResponse = {
  username: string;
  name: string;
  skills: PlayerSkill[];
};

export type ApiError = { error: string };

// --- shaping (server side) -------------------------------------------------

/**
 * Which row gets the yellow highlight.
 *
 * A name search highlights the player asked for; a rank search highlights the
 * row *at* that rank, which is the bottom row of the window unless the rank is
 * inside the first screenful. Neither is highlighted if the row is not there,
 * so a rank past the end of the table renders nothing rather than a stray
 * marker.
 */
export function highlightFor(
  selection: TableParams["selection"],
  rows: readonly HiscoreRow[],
): string | null {
  if (selection.kind === "name") {
    return rows.some((row) => row.username === selection.username)
      ? selection.username
      : null;
  }
  if (selection.kind === "rank") {
    return rows.find((row) => row.rank === selection.rank)?.username ?? null;
  }
  return null;
}

export function toHiscoresResponse(
  params: TableParams,
  rows: readonly TableRow[],
  displayName: (username: string) => string,
): HiscoresResponse {
  const shaped = rows.map((row) => ({
    rank: row.rank,
    username: row.username,
    name: displayName(row.username),
    level: row.level,
    xp: xpFromValue(row.value),
  }));

  return {
    profile: params.profile,
    category: params.category,
    rows: shaped,
    highlight: highlightFor(params.selection, shaped),
  };
}

export function toPlayerResponse(
  username: string,
  rows: readonly PlayerRow[],
  displayName: (username: string) => string,
): PlayerResponse {
  return {
    username,
    name: displayName(username),
    skills: rows.map((row) => ({
      category: row.category,
      rank: row.rank,
      level: row.level,
      xp: xpFromValue(row.value),
    })),
  };
}

// --- parsing (client side) -------------------------------------------------

function asRecord(value: unknown, where: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${where} must be a JSON object`);
  }
  return value as Record<string, unknown>;
}

function requireNumber(
  source: Record<string, unknown>,
  key: string,
  where: string,
): number {
  const value = source[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${where}: "${key}" must be a number`);
  }
  return value;
}

function requireString(
  source: Record<string, unknown>,
  key: string,
  where: string,
): string {
  const value = source[key];
  if (typeof value !== "string" || value === "") {
    throw new Error(`${where}: "${key}" must be a non-empty string`);
  }
  return value;
}

function requireArray(
  source: Record<string, unknown>,
  key: string,
  where: string,
): unknown[] {
  const value = source[key];
  if (!Array.isArray(value)) {
    throw new Error(`${where}: "${key}" must be an array`);
  }
  return value;
}

export function parseHiscoresResponse(json: unknown): HiscoresResponse {
  const where = "hiscores response";
  const body = asRecord(json, where);
  const highlight = body.highlight;
  if (highlight !== null && typeof highlight !== "string") {
    throw new Error(`${where}: "highlight" must be a string or null`);
  }

  return {
    profile: requireString(body, "profile", where),
    category: requireNumber(body, "category", where),
    highlight: highlight ?? null,
    rows: requireArray(body, "rows", where).map((raw, index) => {
      const at = `${where}: rows[${index}]`;
      const row = asRecord(raw, at);
      return {
        rank: requireNumber(row, "rank", at),
        username: requireString(row, "username", at),
        name: requireString(row, "name", at),
        level: requireNumber(row, "level", at),
        xp: requireNumber(row, "xp", at),
      };
    }),
  };
}

export function parsePlayerResponse(json: unknown): PlayerResponse {
  const where = "player response";
  const body = asRecord(json, where);

  return {
    username: requireString(body, "username", where),
    name: requireString(body, "name", where),
    skills: requireArray(body, "skills", where).map((raw, index) => {
      const at = `${where}: skills[${index}]`;
      const skill = asRecord(raw, at);
      return {
        category: requireNumber(skill, "category", at),
        rank: requireNumber(skill, "rank", at),
        level: requireNumber(skill, "level", at),
        xp: requireNumber(skill, "xp", at),
      };
    }),
  };
}

/** The one place the cache policy for both hiscores routes is written down. */
export const HISCORES_CACHE_CONTROL =
  "public, s-maxage=60, stale-while-revalidate=600";
