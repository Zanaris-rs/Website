/**
 * Pure helpers for the world list. No DOM, no React: everything here is
 * unit-testable on its own (see `lib/worlds.test.ts`).
 *
 * Two JSON contracts are consumed:
 *
 * - `/worlds.json`, written at the site root by the deploy script:
 *   `[{ "id": 1, "name": "World 1", "region": "US-East",
 *       "members": true, "url": "https://w1.04.retired.invalid" }]`
 * - `<world origin>/world.json`, served by each game world:
 *   `{ "id": 1, "members": true, "players": 3, "maxPlayers": 150 }`
 */

export type WorldEntry = {
  id: number;
  name: string;
  region: string;
  members: boolean;
  url: string;
};

export type WorldInfo = {
  id: number;
  members: boolean;
  players: number;
  maxPlayers: number;
};

export type CountState =
  | { kind: "loading" }
  | { kind: "ok"; players: number; maxPlayers: number }
  | { kind: "offline" };

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
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${where}: "${key}" must be a non-empty string`);
  }
  return value;
}

function requireBoolean(
  source: Record<string, unknown>,
  key: string,
  where: string,
): boolean {
  const value = source[key];
  if (typeof value !== "boolean") {
    throw new Error(`${where}: "${key}" must be a boolean`);
  }
  return value;
}

/** `https://w1.example.com/` -> `https://w1.example.com` */
export function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

/**
 * Validate the deploy script's `worlds.json`. Throws on anything that is not a
 * well-formed list, so the caller can fall back to "World list unavailable".
 */
export function parseWorlds(json: unknown): WorldEntry[] {
  if (!Array.isArray(json)) {
    throw new Error("worlds.json must be an array of worlds");
  }

  return json.map((raw, index) => {
    const where = `worlds.json[${index}]`;
    const entry = asRecord(raw, where);
    const url = trimTrailingSlash(requireString(entry, "url", where));
    if (url === "") {
      throw new Error(`${where}: "url" must be a non-empty string`);
    }

    return {
      id: requireNumber(entry, "id", where),
      name: requireString(entry, "name", where),
      region: requireString(entry, "region", where),
      members: requireBoolean(entry, "members", where),
      url,
    };
  });
}

/** Validate a single world's `world.json`. Unknown extra fields are ignored. */
export function parseWorldInfo(json: unknown): WorldInfo {
  const where = "world.json";
  const info = asRecord(json, where);

  return {
    id: requireNumber(info, "id", where),
    members: requireBoolean(info, "members", where),
    players: requireNumber(info, "players", where),
    maxPlayers: requireNumber(info, "maxPlayers", where),
  };
}

/** The text shown in a world row's players cell. */
export function playersLabel(state: CountState): string {
  switch (state.kind) {
    case "loading":
      return "...";
    case "ok":
      return `${state.players} / ${state.maxPlayers}`;
    case "offline":
      return "offline";
  }
}

/** Link to a world's game client, high detail by default. */
export function clientUrl(url: string, lowmem: boolean): string {
  const client = `${trimTrailingSlash(url)}/rs2.cgi`;
  return lowmem ? `${client}?lowmem=1` : client;
}

/**
 * `fetch` that gives up after `ms` milliseconds. A world that is down often
 * hangs rather than refusing, so the player count must not wait on it forever.
 */
export async function fetchWithTimeout(
  url: string,
  ms: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(timer);
  }
}
