import { INVALID_NAME, toSafeName } from "@/lib/base37";

import { isCategory, OVERALL } from "./categories";

/**
 * Query-string parsing for the hiscores routes and pages.
 *
 * Pure and total: it never throws and never touches the database, so the route
 * handler's only job is to turn a `Failure` into a 400. Every rejection has a
 * machine-readable code so the client can say something specific.
 */

export const DEFAULT_PROFILE = "main";

/** The one profile this fleet publishes. Lost City also has its betas. */
export const PROFILES: readonly { id: string; name: string }[] = [
  { id: DEFAULT_PROFILE, name: "Main" },
];

/** Postgres text, but keep it to something that cannot surprise a URL. */
const PROFILE_PATTERN = /^[a-z0-9][a-z0-9-]{0,31}$/;

/** Guards against a `rank=1e9` that would ask Postgres to rank the world. */
export const MAX_RANK = 2_000_000;

export type TableSelection =
  | { readonly kind: "top" }
  | { readonly kind: "rank"; readonly rank: number }
  | { readonly kind: "name"; readonly username: string };

export type TableParams = {
  readonly profile: string;
  readonly category: number;
  readonly selection: TableSelection;
};

export type PlayerParams = {
  readonly profile: string;
  readonly username: string;
};

export type ParamError =
  | "bad_profile"
  | "bad_category"
  | "bad_rank"
  | "bad_name";

export type Parsed<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: ParamError };

/** A `URLSearchParams`, or anything else that can answer `get`. */
type Query = { get(name: string): string | null };

function parseProfile(query: Query): string | null {
  const raw = query.get("profile");
  if (raw === null || raw === "") return DEFAULT_PROFILE;
  return PROFILE_PATTERN.test(raw) ? raw : null;
}

function parseCategory(query: Query): number | null {
  const raw = query.get("category");
  if (raw === null || raw === "") return OVERALL;
  if (!/^\d{1,3}$/.test(raw)) return null;
  const category = Number(raw);
  return isCategory(category) ? category : null;
}

function parseRank(raw: string): number | null {
  if (!/^\d{1,9}$/.test(raw)) return null;
  const rank = Number(raw);
  if (rank < 1 || rank > MAX_RANK) return null;
  return rank;
}

/**
 * `?profile=&category=&rank=` or `&name=` / `&username=`.
 *
 * A name search wins over a rank search when both are present: it is the more
 * specific request, and the two search boxes each carry only their own field.
 */
export function parseTableParams(query: Query): Parsed<TableParams> {
  const profile = parseProfile(query);
  if (profile === null) return { ok: false, error: "bad_profile" };

  const category = parseCategory(query);
  if (category === null) return { ok: false, error: "bad_category" };

  const rawName = query.get("name") ?? query.get("username");
  if (rawName !== null && rawName.trim() !== "") {
    const username = toSafeName(rawName);
    // `invalid_name` is what base37 returns for a name it cannot encode; it is
    // never a real account, so treat it as a malformed request rather than
    // looking it up.
    if (username === INVALID_NAME) return { ok: false, error: "bad_name" };
    return {
      ok: true,
      value: { profile, category, selection: { kind: "name", username } },
    };
  }

  const rawRank = query.get("rank");
  if (rawRank !== null && rawRank.trim() !== "") {
    const rank = parseRank(rawRank.trim());
    if (rank === null) return { ok: false, error: "bad_rank" };
    return {
      ok: true,
      value: { profile, category, selection: { kind: "rank", rank } },
    };
  }

  return { ok: true, value: { profile, category, selection: { kind: "top" } } };
}

/** `/api/hiscores/player/<username>?profile=`. */
export function parsePlayerParams(
  rawUsername: string,
  query: Query,
): Parsed<PlayerParams> {
  const profile = parseProfile(query);
  if (profile === null) return { ok: false, error: "bad_profile" };

  const username = toSafeName(decodeSafely(rawUsername));
  if (username === INVALID_NAME) return { ok: false, error: "bad_name" };

  return { ok: true, value: { profile, username } };
}

/** A path segment arrives percent-encoded; a malformed one is just a bad name. */
function decodeSafely(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return "";
  }
}

/**
 * The link to one category's table.
 *
 * Deliberately carries no search: switching table on the 2004 site cleared the
 * rank or name, and a rank means something different in another skill. The
 * default profile is left out so the common URL is the short one.
 */
export function tableHref({
  profile,
  category,
}: {
  profile?: string;
  category: number;
}): string {
  const search = new URLSearchParams();
  if (profile && profile !== DEFAULT_PROFILE) search.set("profile", profile);
  search.set("category", String(category));
  return `/hiscores?${search.toString()}`;
}
