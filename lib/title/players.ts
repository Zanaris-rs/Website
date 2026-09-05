import type { WorldInfo } from "@/lib/worlds";

/**
 * The live player count on the title screen.
 *
 * Pure half: how the per-world answers add up, and how the number is said.
 * `lib/title/fetch.ts` does the asking.
 */

/**
 * A world that is down often hangs rather than refusing the connection, and
 * the title screen is prerendered — a slow world must not hold up a
 * revalidation. Two seconds is long enough for a healthy world in the same
 * region and short enough that nobody waits on a dead one.
 */
export const COUNT_TIMEOUT_MS = 2000;

/**
 * Total players across the worlds that answered. A world that failed counts
 * as zero rather than making the whole number unavailable: "0 people playing"
 * is wrong in a small way, and no title screen at all is wrong in a large one.
 */
export function sumPlayers(results: PromiseSettledResult<WorldInfo>[]): number {
  let total = 0;
  for (const result of results) {
    if (result.status === "fulfilled") {
      total += result.value.players;
    }
  }
  return total;
}

/** `There are currently 3 people playing!`, with 2004's own grammar. */
export function playingSentence(players: number): string {
  return players === 1
    ? "There is currently 1 person playing!"
    : `There are currently ${players} people playing!`;
}
