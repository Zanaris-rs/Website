import worldsJson from "@/public/worlds.json";
import { parseWorlds } from "@/lib/worlds";

/**
 * The worlds a clan can call home: the site's own list (`public/worlds.json`,
 * which the deploy script writes). Migration 17 stores 1-255 or nothing and
 * leaves the list to the site, so a world taken off the list is simply no
 * longer shown. Pure: the Clan tab's World select loads it in the browser.
 */

export type ClanWorld = { id: number; name: string; region: string };

function listed(): ClanWorld[] {
  try {
    return parseWorlds(worldsJson)
      .filter((world) => Number.isInteger(world.id) && world.id >= 1 && world.id <= 255)
      .map(({ id, name, region }) => ({ id, name, region }));
  } catch (error) {
    console.warn("[clans] worlds.json could not be parsed:", error);
    return [];
  }
}

export const CLAN_WORLDS: readonly ClanWorld[] = listed();

export function isClanWorld(id: unknown): id is number {
  return CLAN_WORLDS.some((world) => world.id === id);
}

/** "World 2 (EU-Central)", or null for none or a world no longer listed. */
export function clanWorldName(id: number | null): string | null {
  const world = CLAN_WORLDS.find((entry) => entry.id === id);
  return world ? `${world.name} (${world.region})` : null;
}
