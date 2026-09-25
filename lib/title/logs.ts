import "server-only";

import { unstable_cache } from "next/cache";

import { type DirectoryEntry, loadDirectory } from "@/lib/adventurer-log/directory";

/** How many logs the title screen lists: three rows of two on a wide screen. */
export const TITLE_LOGS = 6;

/**
 * The most recently active Adventurer Logs, for `/title`'s panel: the first
 * few rows of `/adventurer-log`, chatheads and all.
 *
 * `/title` renders per request, and until now only a signed-in visitor cost
 * it a database read. This one is the same for everybody - the directory
 * shows nothing sooner than the logs themselves do, and nothing depends on
 * who is looking - so it is cached for a minute, and the title screen asks
 * the database once a minute however many people open it.
 */
const readLatestLogs = unstable_cache(
  async () => (await loadDirectory(null, TITLE_LOGS)).entries,
  ["title-adventurer-logs"],
  { revalidate: 60 },
);

/**
 * Null when the logs cannot be read. A failed read is not cached, so the
 * next visitor tries again; the panel still links to the directory.
 */
export async function latestLogs(): Promise<DirectoryEntry[] | null> {
  try {
    return await readLatestLogs();
  } catch (error) {
    console.error("[title] adventurer logs read failed", error);
    return null;
  }
}
