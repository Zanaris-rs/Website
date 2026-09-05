import "server-only";

import worldsJson from "@/public/worlds.json";
import { parseWorldInfo, parseWorlds, type WorldEntry } from "@/lib/worlds";

import { COUNT_TIMEOUT_MS, sumPlayers } from "./players";

/**
 * Asking every world how many people are on it, from the server.
 *
 * Not `fetchWithTimeout` from `lib/worlds.ts`: that one is for the browser and
 * sets `cache: "no-store"`, which would opt this request out of the data cache
 * and make `revalidate = 15` on the page meaningless. Here the request is
 * tagged with the same 15-second window as the page, so one revalidation asks
 * each world once no matter how many times the page is rendered.
 */

/**
 * The deployed world list. `public/worlds.json` is rewritten by the deploy
 * script, so this import is a build-time snapshot — which is the right shape
 * for a prerendered page. A malformed file means no worlds and a count of
 * zero, never a failed build.
 */
export function worldList(): WorldEntry[] {
  try {
    return parseWorlds(worldsJson);
  } catch (error) {
    console.warn("[title] worlds.json could not be parsed:", error);
    return [];
  }
}

/** How many people are playing right now, across every world that answers. */
export async function countPlayers(worlds: WorldEntry[]): Promise<number> {
  const results = await Promise.allSettled(
    worlds.map(async (world) => {
      const response = await fetch(`${world.url}/world.json`, {
        signal: AbortSignal.timeout(COUNT_TIMEOUT_MS),
        next: { revalidate: 15 },
      });
      if (!response.ok) {
        throw new Error(`world.json: HTTP ${response.status}`);
      }
      return parseWorldInfo(await response.json());
    }),
  );

  return sumPlayers(results);
}
