import {
  type Census,
  ECONOMY_DEFAULT_WINDOW,
  type EconomyWindow,
  type Snapshot,
  type StaffSpawn,
  type StaffSpawnTotal,
  type TrackedItem,
  economyWindow,
} from "./queries";
import type { SpawnRecord } from "./spawns";

/**
 * The JSON contract for the public census API, and everything about it that
 * can be decided without a database.
 *
 * Same split as `lib/hiscores/api.ts` and for the same reason: parsing,
 * shaping and cache policy are pure and total, so they are tested here rather
 * than through a route handler, and the handlers under `app/api/economy/` are
 * left with nothing to do but read and answer.
 */

export type EconomyParams = {
  readonly window: EconomyWindow;
  /** Whether each hour carries its tracked-rare counts. Off by default. */
  readonly tracked: boolean;
};

export type EconomyParamError = "bad_window" | "bad_tracked";

export type Parsed<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: EconomyParamError };

/** A `URLSearchParams`, or anything else that can answer `get`. */
type Query = { get(name: string): string | null };

/**
 * `?window=` and `?tracked=`, or the defaults.
 *
 * An absent parameter and an empty one are the same thing: `?window=` is what
 * a form or a hand-built URL produces when nothing was chosen, and rejecting
 * it would be refusing a request that asked for the default.
 */
export function parseEconomyParams(query: Query): Parsed<EconomyParams> {
  const rawWindow = query.get("window");
  const window =
    rawWindow === null || rawWindow === ""
      ? ECONOMY_DEFAULT_WINDOW
      : economyWindow(rawWindow);
  if (window === null) return { ok: false, error: "bad_window" };

  const rawTracked = query.get("tracked");
  if (rawTracked !== null && rawTracked !== "") {
    if (rawTracked !== "true" && rawTracked !== "false") {
      return { ok: false, error: "bad_tracked" };
    }
  }

  return {
    ok: true,
    value: { window, tracked: rawTracked === "true" },
  };
}

/* --- the bodies --- */

/** One hour, totals only: what `?tracked=` leaves off. */
export type SnapshotTotals = {
  readonly takenAt: string | null;
  readonly players: number | null;
  readonly coins: number | null;
};

/** One hour with its tracked-rare counts, which `?tracked=true` asks for. */
export type TrackedSnapshot = SnapshotTotals & {
  readonly tracked: readonly TrackedItem[];
};

export type SnapshotsResponse = {
  /** The slug that was answered for, echoed so a response stands alone. */
  readonly window: string;
  readonly days: number;
  /** The newest census in `snapshots`, or `null` when there are none. */
  readonly takenAt: string | null;
  readonly count: number;
  readonly snapshots: readonly (SnapshotTotals | TrackedSnapshot)[];
};

/**
 * The series over a window, with the rares left off unless asked for.
 *
 * Totals-only is the default because the widest window is where this endpoint
 * gets expensive: ninety days is 2,160 hours, and fifteen tracked rares on
 * each of them is thirty-odd thousand id-and-count pairs — an order of
 * magnitude more body than the players-and-coins line most callers want. The
 * key is *omitted* rather than emptied, so a caller cannot mistake "not asked
 * for" for "nothing was tracked that hour".
 *
 * `takenAt` is the last row and not the first: `parseSnapshots` sorts oldest
 * first, which is the order a chart wants to draw.
 */
export function toSnapshotsResponse(
  window: EconomyWindow,
  snapshots: readonly Snapshot[],
  tracked: boolean,
): SnapshotsResponse {
  const rows = snapshots.map((snapshot) =>
    tracked
      ? {
          takenAt: snapshot.takenAt,
          players: snapshot.players,
          coins: snapshot.coins,
          tracked: snapshot.tracked,
        }
      : {
          takenAt: snapshot.takenAt,
          players: snapshot.players,
          coins: snapshot.coins,
        },
  );

  return {
    window: window.slug,
    days: window.days,
    takenAt: snapshots.at(-1)?.takenAt ?? null,
    count: rows.length,
    snapshots: rows,
  };
}

export type LatestResponse = {
  readonly takenAt: string | null;
  readonly players: number | null;
  readonly coins: number | null;
  readonly items: readonly TrackedItem[];
};

/**
 * The newest census, or the shape of one that has not happened.
 *
 * A `null` census is a server whose first hour has not come round yet, which
 * is a complete answer and so a 200. Only a read that could not be made is a
 * 503 — the same distinction `read-server.ts` draws between "no rows" and
 * "unavailable", and the one this whole feature rests on.
 */
export function toLatestResponse(census: Census | null): LatestResponse {
  if (census === null) {
    return { takenAt: null, players: null, coins: null, items: [] };
  }

  return {
    takenAt: census.takenAt,
    players: census.players,
    coins: census.coins,
    items: census.items,
  };
}

export type SpawnsResponse = {
  readonly total: StaffSpawnTotal | null;
  /** Whether `spawns` is the whole table rather than a ninety-day window. */
  readonly allTime: boolean;
  readonly spawns: readonly StaffSpawn[] | null;
};

/**
 * What staff have created, and how much of the table the answer covers.
 *
 * `allTime` is part of the contract rather than an implementation detail: the
 * windowed and the all-time reads return the same four columns, so rows alone
 * cannot say which they came from, and a consumer printing "ever" over ninety
 * days would make exactly the claim `SpawnRecord` was reshaped to prevent.
 */
export function toSpawnsResponse(record: SpawnRecord): SpawnsResponse {
  return {
    total: record.total,
    allTime: record.allTime,
    spawns: record.spawns,
  };
}

/* --- freshness --- */

/**
 * The one place the cache policy for all three census routes is written down.
 *
 * Five minutes of shared cache, and an hour of serving the stale copy while a
 * new one is fetched behind it. The census runs hourly, so this is at most a
 * twelfth of a census behind — comfortably inside "a fresh copy every hour",
 * and the same clock `/economy` itself keeps.
 *
 * An hour would be the tempting number and the wrong one: a copy cached at
 * :59 holding the :00 census would go on being served until the *next* :59,
 * so a reader arriving at :05 would get an hour-old answer with a fresher one
 * sitting in the database. Expiry aligned to the census boundary would fix
 * that and buy nothing else — the reads are an indexed range scan against a
 * pool that is idle between them — so it is not worth the coupling to a
 * schedule this repo does not own.
 *
 * `stale-while-revalidate` is doing the real work under load: it keeps a
 * cache miss off the reader's critical path, which matters more here than the
 * TTL does, because the pool is two connections per instance and a cold
 * deploy can miss on every one of them at once.
 */
export const ECONOMY_CACHE_CONTROL =
  "public, s-maxage=300, stale-while-revalidate=3600";

/** A strong entity tag from parts that, together, name one body exactly. */
function tag(...parts: readonly (string | number | boolean | null)[]): string {
  return `"${parts.map((part) => (part === null ? "-" : String(part))).join(":")}"`;
}

/**
 * A tag for one window of the series, in one shape.
 *
 * Four things can change the body and all four are in the tag:
 *
 * - **the newest census**, which is the obvious one;
 * - **the oldest**, because the window *slides*. At 10:05 a 24-hour read
 *   covers yesterday 10:05 to today 10:00; at 10:55 it covers yesterday 10:55
 *   to the same 10:00. The newest row is unchanged and the oldest hours have
 *   rolled off, so a tag made from the newest alone would answer 304 with a
 *   body the caller does not have;
 * - **the count**, which pins the rows between those two ends;
 * - **the shape**, because `?tracked=true` over the same rows is a different
 *   body, and a caller who fetched totals and then asked for the rares would
 *   otherwise be told nothing had changed.
 */
export function snapshotsEtag(
  window: EconomyWindow,
  snapshots: readonly Snapshot[],
  tracked: boolean,
): string {
  return tag(
    "snapshots",
    window.slug,
    tracked ? "tracked" : "totals",
    snapshots.at(0)?.takenAt ?? null,
    snapshots.at(-1)?.takenAt ?? null,
    snapshots.length,
  );
}

/** A tag for the newest census. One row, so one timestamp names it. */
export function latestEtag(census: Census | null): string {
  return tag("latest", census?.takenAt ?? null);
}

/**
 * A tag for the staff-spawn record.
 *
 * `allTime` is in it for the same reason it is in the body: the same rows
 * under a different claim about what they cover are a different answer.
 */
export function spawnsEtag(record: SpawnRecord): string {
  return tag(
    "spawns",
    record.allTime,
    record.total?.lastAt ?? null,
    record.total?.spawns ?? null,
    record.total?.items ?? null,
    record.spawns?.length ?? null,
  );
}

/* --- cross-origin --- */

/**
 * The census is open to any origin, and that is a deliberate door.
 *
 * There is no session behind these routes and nothing to authorise: the
 * `SECURITY DEFINER` functions decide what is public, and this API only asks
 * them. What `*` adds is the ability for a page on someone else's site to
 * read it, which is the point of publishing it.
 *
 * Two of these are easy to leave out and quietly disable the 304 path for the
 * callers most likely to want it:
 *
 * - **`Expose-Headers: ETag`.** CORS exposes six response headers by default
 *   and `ETag` is not one of them, so without this a browser cannot read the
 *   tag it was sent and can never send `If-None-Match`.
 * - **`Allow-Headers: If-None-Match`.** A conditional GET is not a simple
 *   request, so it preflights; a preflight that does not permit the header
 *   means the browser never makes the request at all.
 *
 * There is no `Allow-Credentials`. It is incompatible with `*` by
 * specification, and naming its absence here is a note to whoever is tempted
 * to add one: a credentialed census would be a different thing entirely.
 */
export const CORS_HEADERS: Readonly<Record<string, string>> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "If-None-Match",
  "Access-Control-Expose-Headers": "ETag",
  /** A day, so a polling page preflights once rather than hourly. */
  "Access-Control-Max-Age": "86400",
};

/**
 * Whether `If-None-Match` names the tag we are about to send.
 *
 * `If-None-Match` compares weakly and may carry a list, so this splits on
 * commas and strips a `W/` prefix rather than comparing the header whole — a
 * cache in the middle is entitled to hand the tag back marked weak, and
 * refusing it would mean sending a full body to exactly the callers being
 * careful about bandwidth. `*` matches anything, which is what the grammar
 * says it means.
 */
export function matchesEtag(
  ifNoneMatch: string | null,
  etag: string,
): boolean {
  if (ifNoneMatch === null || ifNoneMatch === "") return false;
  if (ifNoneMatch.trim() === "*") return true;

  const weak = (value: string) =>
    value.trim().replace(/^W\//, "");

  return ifNoneMatch
    .split(",")
    .some((candidate) => weak(candidate) === weak(etag));
}

/* --- the answers --- */

/**
 * A census answer: the body, or a 304 for a caller who already has it.
 *
 * The 304 keeps its `ETag` and `Cache-Control` rather than being bare. A 304
 * *replaces* the headers of the stored response it validates, so dropping
 * them leaves a cache holding an entry it can neither revalidate nor age —
 * which turns the next request into a full fetch and undoes the saving.
 *
 * No `Vary`. Every response carries `Access-Control-Allow-Origin: *`
 * regardless of who asked, so the answer does not depend on the request's
 * `Origin` and a shared cache can serve one copy to everyone. Varying on
 * `Origin` here would fragment the CDN cache per origin for no benefit.
 */
export function economyResponse(
  body: unknown,
  etag: string,
  ifNoneMatch: string | null,
): Response {
  const headers = {
    ...CORS_HEADERS,
    "Cache-Control": ECONOMY_CACHE_CONTROL,
    ETag: etag,
  };

  if (matchesEtag(ifNoneMatch, etag)) {
    return new Response(null, { status: 304, headers });
  }

  return Response.json(body, { headers });
}

/**
 * A fault, named and uncacheable.
 *
 * The CORS headers are on it deliberately: without them a 400 for a bad
 * window reaches a browser as an opaque network error, and a caller with a
 * typo in their query string has nothing to go on.
 */
export function economyError(
  status: number,
  error: EconomyParamError | "unavailable",
): Response {
  return Response.json(
    { error },
    {
      status,
      headers: { ...CORS_HEADERS, "Cache-Control": "no-store" },
    },
  );
}

/** The preflight a conditional cross-origin GET provokes. */
export function economyPreflight(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
