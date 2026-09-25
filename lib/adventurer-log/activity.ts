import { excerpt } from "./body";
import { type EventIcon, eventIcon } from "./events";
import type { DirectoryRow } from "./queries";

/**
 * What the directory says a log last did: the adventure as the log words it,
 * with its picture, or the start of the update it last posted.
 */
export function activityOf(row: DirectoryRow): { icon: EventIcon; activity: string } {
  if (row.lastKind === "update") {
    return { icon: null, activity: `Posted an update: “${excerpt(row.lastBody)}”` };
  }
  return { icon: eventIcon(row.lastCategory ?? -1, row.lastBody), activity: row.lastBody };
}
