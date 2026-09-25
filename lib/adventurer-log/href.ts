/**
 * Where the Adventurer Log lives on the site. A player's public page is
 * `/adventurer/<name>` and the directory of every log is `/adventurers`;
 * every link to either goes through here, so the address is one edit.
 *
 * The old `/adventurer-log/...` addresses redirect here (next.config.ts).
 * The owner's pages (`/account/adventurer-log`) and the API
 * (`/api/adventurer-log/...`) are not shareable addresses and keep their
 * paths.
 */

export const DIRECTORY_HREF = "/adventurers";

export function logHref(username: string): string {
  return `/adventurer/${encodeURIComponent(username)}`;
}
