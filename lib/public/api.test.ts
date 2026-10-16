import { describe, expect, it } from "vitest";

import {
  ECONOMY_DEFAULT_WINDOW,
  ECONOMY_WINDOWS,
  type Snapshot,
} from "./queries";
import {
  CORS_HEADERS,
  economyError,
  economyPreflight,
  economyResponse,
  ECONOMY_CACHE_CONTROL,
  latestEtag,
  matchesEtag,
  parseEconomyParams,
  snapshotsEtag,
  spawnsEtag,
  toLatestResponse,
  toSnapshotsResponse,
  toSpawnsResponse,
} from "./api";

const query = (search: string) => new URLSearchParams(search);

describe("parseEconomyParams", () => {
  it("defaults to the same window the pages default to", () => {
    const parsed = parseEconomyParams(query(""));

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.window).toEqual(ECONOMY_DEFAULT_WINDOW);
  });

  it("defaults to totals only, so the largest window stays small", () => {
    const parsed = parseEconomyParams(query(""));

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.tracked).toBe(false);
  });

  it("reads a window by the slug the pages use", () => {
    const parsed = parseEconomyParams(query("window=7-days"));

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.window.days).toBe(7);
  });

  /**
   * `/economy/30-days` is a 404 on the site, because the default window has one
   * URL and `/economy` is it. A query parameter has no such problem — there is
   * no second URL to be canonical about — so the API answers to it rather than
   * rejecting the one slug a reader is most likely to write out in full.
   */
  it("answers to the default window named explicitly", () => {
    const parsed = parseEconomyParams(query("window=30-days"));

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.window.days).toBe(30);
  });

  it("refuses a window it does not publish", () => {
    const parsed = parseEconomyParams(query("window=365-days"));

    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.error).toBe("bad_window");
  });

  it("opts into the tracked rares when asked", () => {
    const parsed = parseEconomyParams(query("tracked=true"));

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.tracked).toBe(true);
  });

  /**
   * Not truthiness: `tracked=yes` and `tracked=1` are a caller who believes
   * they asked for the rares, and silently handing back totals would be a
   * quietly wrong answer rather than a loud one.
   */
  it("refuses a tracked flag that is not a boolean", () => {
    const parsed = parseEconomyParams(query("tracked=1"));

    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.error).toBe("bad_tracked");
  });

  it("treats an empty parameter as absent", () => {
    const parsed = parseEconomyParams(query("window=&tracked="));

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.window).toEqual(ECONOMY_DEFAULT_WINDOW);
    expect(parsed.value.tracked).toBe(false);
  });
});

describe("toSnapshotsResponse", () => {
  const hour = (at: string, players: number, coins: number): Snapshot => ({
    takenAt: at,
    players,
    coins,
    tracked: [{ id: 1038, count: 3 }],
  });

  const hours = [
    hour("2026-09-19T22:00:00.000Z", 10, 100),
    hour("2026-09-19T23:00:00.000Z", 11, 110),
    hour("2026-09-20T00:00:00.000Z", 12, 120),
  ];

  it("names the window it answered for", () => {
    const body = toSnapshotsResponse(ECONOMY_DEFAULT_WINDOW, hours, false);

    expect(body.window).toBe(ECONOMY_DEFAULT_WINDOW.slug);
    expect(body.days).toBe(ECONOMY_DEFAULT_WINDOW.days);
  });

  /**
   * The freshness marker every endpoint carries. `parseSnapshots` sorts oldest
   * first, so the newest census is the last row and not the first.
   */
  it("reports the newest census as takenAt", () => {
    const body = toSnapshotsResponse(ECONOMY_DEFAULT_WINDOW, hours, false);

    expect(body.takenAt).toBe("2026-09-20T00:00:00.000Z");
  });

  it("leaves the tracked rares off by default", () => {
    const body = toSnapshotsResponse(ECONOMY_DEFAULT_WINDOW, hours, false);

    expect(body.count).toBe(3);
    expect(body.snapshots[0]).toEqual({
      takenAt: "2026-09-19T22:00:00.000Z",
      players: 10,
      coins: 100,
    });
    expect("tracked" in body.snapshots[0]).toBe(false);
  });

  it("carries the tracked rares when they were asked for", () => {
    const body = toSnapshotsResponse(ECONOMY_DEFAULT_WINDOW, hours, true);

    expect(body.snapshots[0]).toEqual({
      takenAt: "2026-09-19T22:00:00.000Z",
      players: 10,
      coins: 100,
      tracked: [{ id: 1038, count: 3 }],
    });
  });

  it("is a finished answer before the first census has run", () => {
    const body = toSnapshotsResponse(ECONOMY_DEFAULT_WINDOW, [], false);

    expect(body.takenAt).toBeNull();
    expect(body.count).toBe(0);
    expect(body.snapshots).toEqual([]);
  });
});

describe("toLatestResponse", () => {
  it("passes the census through whole", () => {
    const body = toLatestResponse({
      takenAt: "2026-09-20T00:00:00.000Z",
      players: 12,
      coins: 120,
      items: [{ id: 995, count: 120 }],
    });

    expect(body).toEqual({
      takenAt: "2026-09-20T00:00:00.000Z",
      players: 12,
      coins: 120,
      items: [{ id: 995, count: 120 }],
    });
  });

  /**
   * A census that has not run is not a failure — it is a server whose first
   * hour has not come round yet, and the route answers 200 saying so. Only a
   * read that could not happen is a 503.
   */
  it("says the census has not run rather than failing", () => {
    const body = toLatestResponse(null);

    expect(body).toEqual({
      takenAt: null,
      players: null,
      coins: null,
      items: [],
    });
  });
});

describe("toSpawnsResponse", () => {
  it("carries the aggregate, the rows, and which read they came from", () => {
    const body = toSpawnsResponse({
      total: { spawns: 0, items: 0, firstAt: null, lastAt: null },
      spawns: [],
      allTime: true,
    });

    expect(body).toEqual({
      total: { spawns: 0, items: 0, firstAt: null, lastAt: null },
      allTime: true,
      spawns: [],
    });
  });

  /**
   * `allTime: false` means the rows are a ninety-day window, not the whole
   * table. A consumer that prints "ever" over a windowed read repeats the
   * exact mistake `SpawnRecord` was reshaped to prevent, so the flag is part
   * of the contract rather than an implementation detail.
   */
  it("keeps a windowed read labelled as one", () => {
    const body = toSpawnsResponse({
      total: null,
      spawns: [{ createdAt: "2026-09-20T00:00:00.000Z", itemId: 1, count: 2, world: 1 }],
      allTime: false,
    });

    expect(body.allTime).toBe(false);
    expect(body.total).toBeNull();
    expect(body.spawns).toHaveLength(1);
  });
});

describe("ECONOMY_CACHE_CONTROL", () => {
  /**
   * The census runs hourly, so five minutes is at most a twelfth of a census
   * behind — the same clock the pages keep, and well inside "a fresh copy
   * every hour". Shorter buys nothing a reader can see; an hour would risk a
   * copy cached at :59 serving the previous census until the next :59.
   */
  it("is a shared cache of five minutes with stale service behind it", () => {
    expect(ECONOMY_CACHE_CONTROL).toContain("public");
    expect(ECONOMY_CACHE_CONTROL).toContain("s-maxage=300");
    expect(ECONOMY_CACHE_CONTROL).toMatch(/stale-while-revalidate=\d+/);
  });
});

describe("snapshotsEtag", () => {
  const at = (hour: string): Snapshot => ({
    takenAt: `2026-09-20T${hour}:00:00.000Z`,
    players: 1,
    coins: 2,
    tracked: [{ id: 1038, count: 3 }],
  });

  const hours = [at("08"), at("09"), at("10")];

  it("is a quoted entity tag", () => {
    expect(snapshotsEtag(ECONOMY_DEFAULT_WINDOW, hours, false)).toMatch(
      /^"[^"]+"$/,
    );
  });

  it("is stable for the same census, window and shape", () => {
    expect(snapshotsEtag(ECONOMY_DEFAULT_WINDOW, hours, false)).toBe(
      snapshotsEtag(ECONOMY_DEFAULT_WINDOW, hours, false),
    );
  });

  it("changes when a new census lands", () => {
    expect(snapshotsEtag(ECONOMY_DEFAULT_WINDOW, hours, false)).not.toBe(
      snapshotsEtag(ECONOMY_DEFAULT_WINDOW, [...hours, at("11")], false),
    );
  });

  /**
   * The same rows in two shapes are two different bodies. Without the flag in
   * the tag, a caller who fetched totals and then asked for the rares would be
   * told 304 and keep the body without them.
   */
  it("distinguishes totals from the tracked shape", () => {
    expect(snapshotsEtag(ECONOMY_DEFAULT_WINDOW, hours, false)).not.toBe(
      snapshotsEtag(ECONOMY_DEFAULT_WINDOW, hours, true),
    );
  });

  it("distinguishes one window from another", () => {
    expect(snapshotsEtag(ECONOMY_WINDOWS[0], hours, false)).not.toBe(
      snapshotsEtag(ECONOMY_WINDOWS[1], hours, false),
    );
  });

  /**
   * The window slides between censuses. At 10:05 a 24-hour read covers
   * yesterday 10:05 to today 10:00; at 10:55 it covers yesterday 10:55 to the
   * same 10:00. The newest census is identical and the oldest hours have
   * rolled off, so a tag made from the newest row alone would claim a body
   * that no longer matches.
   */
  it("changes when the oldest hours roll off under an unchanged census", () => {
    expect(snapshotsEtag(ECONOMY_DEFAULT_WINDOW, hours, false)).not.toBe(
      snapshotsEtag(ECONOMY_DEFAULT_WINDOW, hours.slice(1), false),
    );
  });

  it("has a tag for a window with nothing in it", () => {
    expect(snapshotsEtag(ECONOMY_DEFAULT_WINDOW, [], false)).toMatch(
      /^"[^"]+"$/,
    );
  });
});

describe("latestEtag", () => {
  const census = {
    takenAt: "2026-09-20T10:00:00.000Z",
    players: 1,
    coins: 2,
    items: [{ id: 995, count: 2 }],
  };

  it("is stable for one census", () => {
    expect(latestEtag(census)).toBe(latestEtag(census));
  });

  it("changes when a new census lands", () => {
    expect(latestEtag(census)).not.toBe(
      latestEtag({ ...census, takenAt: "2026-09-20T11:00:00.000Z" }),
    );
  });

  it("has a tag before the first census has run", () => {
    expect(latestEtag(null)).toMatch(/^"[^"]+"$/);
    expect(latestEtag(null)).not.toBe(latestEtag(census));
  });
});

describe("spawnsEtag", () => {
  const empty = {
    total: { spawns: 0, items: 0, firstAt: null, lastAt: null },
    spawns: [],
    allTime: true,
  };

  it("is stable for an unchanged table", () => {
    expect(spawnsEtag(empty)).toBe(spawnsEtag(empty));
  });

  it("changes when a spawn is recorded", () => {
    expect(spawnsEtag(empty)).not.toBe(
      spawnsEtag({
        total: {
          spawns: 1,
          items: 5,
          firstAt: "2026-09-20T10:00:00.000Z",
          lastAt: "2026-09-20T10:00:00.000Z",
        },
        spawns: [
          { createdAt: "2026-09-20T10:00:00.000Z", itemId: 1, count: 5, world: 1 },
        ],
        allTime: true,
      }),
    );
  });

  /**
   * Same rows, different claim about what they cover — so a different body,
   * and it must not be served from a tag that says otherwise.
   */
  it("distinguishes an all-time read from a windowed one", () => {
    expect(spawnsEtag(empty)).not.toBe(spawnsEtag({ ...empty, allTime: false }));
  });
});

describe("CORS_HEADERS", () => {
  it("opens the census to any origin", () => {
    expect(CORS_HEADERS["Access-Control-Allow-Origin"]).toBe("*");
  });

  it("allows only the methods a read-only API has", () => {
    const methods = CORS_HEADERS["Access-Control-Allow-Methods"];

    expect(methods).toContain("GET");
    expect(methods).not.toContain("POST");
    expect(methods).not.toContain("DELETE");
  });

  /**
   * Without this, a browser cannot *read* the tag it is being sent — the CORS
   * default exposes six response headers and `ETag` is not among them — so a
   * cross-origin caller could never send `If-None-Match` and the 304 path
   * would exist for everyone except the browsers most likely to poll.
   */
  it("exposes the entity tag to cross-origin callers", () => {
    expect(CORS_HEADERS["Access-Control-Expose-Headers"]).toContain("ETag");
  });

  /**
   * A conditional GET is not a simple request, so it preflights. Leaving
   * `If-None-Match` out of the allowed headers means the browser never sends
   * the request it was told to make.
   */
  it("permits the conditional request header on a preflight", () => {
    expect(CORS_HEADERS["Access-Control-Allow-Headers"]).toContain(
      "If-None-Match",
    );
  });

  /**
   * `Allow-Origin: *` and credentials are incompatible by specification, and
   * this API has no session behind it — the `SECURITY DEFINER` functions
   * decide what is public. Saying so explicitly keeps a later edit from
   * quietly making the census a credentialed endpoint.
   */
  it("never invites credentials", () => {
    expect(CORS_HEADERS).not.toHaveProperty("Access-Control-Allow-Credentials");
  });
});

describe("matchesEtag", () => {
  const etag = '"latest:2026-09-20T10:00:00.000Z"';

  it("does not match when the caller sent no tag", () => {
    expect(matchesEtag(null, etag)).toBe(false);
  });

  it("matches the same tag", () => {
    expect(matchesEtag(etag, etag)).toBe(true);
  });

  it("does not match a tag from an earlier census", () => {
    expect(matchesEtag('"latest:2026-09-20T09:00:00.000Z"', etag)).toBe(false);
  });

  it("matches any tag when the caller sent a wildcard", () => {
    expect(matchesEtag("*", etag)).toBe(true);
  });

  it("finds the tag in a list of them", () => {
    expect(matchesEtag(`"latest:old", ${etag}`, etag)).toBe(true);
  });

  /**
   * `If-None-Match` compares weakly, and a cache in the middle may hand the
   * tag back marked weak. Refusing `W/` would turn a 304 into a full body for
   * exactly the callers being polite about bandwidth.
   */
  it("matches a tag a cache marked weak", () => {
    expect(matchesEtag(`W/${etag}`, etag)).toBe(true);
  });
});

describe("economyResponse", () => {
  const etag = '"latest:2026-09-20T10:00:00.000Z"';
  const body = { takenAt: "2026-09-20T10:00:00.000Z" };

  it("answers with the body, the cache policy and the tag", async () => {
    const response = economyResponse(body, etag, null);

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe(ECONOMY_CACHE_CONTROL);
    expect(response.headers.get("ETag")).toBe(etag);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    await expect(response.json()).resolves.toEqual(body);
  });

  /**
   * The point of the tag. A poller that already has this census gets a header
   * and no body — which on the ninety-day window with the rares attached is
   * the difference between a few hundred bytes and a few hundred kilobytes.
   */
  it("answers 304 with no body when the caller already has this census", async () => {
    const response = economyResponse(body, etag, etag);

    expect(response.status).toBe(304);
    expect(await response.text()).toBe("");
  });

  /**
   * A 304 has to carry them: it replaces the stored response's headers, so a
   * bare one would leave a cache with an entry it can no longer revalidate or
   * tell the age of.
   */
  it("keeps the tag and the cache policy on a 304", () => {
    const response = economyResponse(body, etag, etag);

    expect(response.headers.get("ETag")).toBe(etag);
    expect(response.headers.get("Cache-Control")).toBe(ECONOMY_CACHE_CONTROL);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("sends the body when the caller's tag is from an older census", async () => {
    const response = economyResponse(body, etag, '"latest:2026-09-20T09:00:00.000Z"');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(body);
  });
});

describe("economyError", () => {
  it("names the fault and refuses to let it be cached", async () => {
    const response = economyError(503, "unavailable");

    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ error: "unavailable" });
  });

  /**
   * A cross-origin caller has to be able to *read* the failure, or a 400 for
   * a bad window arrives in the browser as an opaque network error with
   * nothing to act on.
   */
  it("stays readable across origins", () => {
    const response = economyError(400, "bad_window");

    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});

describe("economyPreflight", () => {
  it("answers a preflight with no content and the permissions", () => {
    const response = economyPreflight();

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(response.headers.get("Access-Control-Allow-Headers")).toContain(
      "If-None-Match",
    );
  });
});
