/**
 * Where clans live on the site: a clan's public page is `/clan/<slug>` and
 * the directory of every clan is `/clans`. Every link to either goes through
 * here, as a log's do through `lib/adventurer-log/href.ts`.
 */

export const CLANS_HREF = "/clans";

export function clanHref(slug: string): string {
  return `/clan/${encodeURIComponent(slug)}`;
}
