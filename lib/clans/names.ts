/**
 * A clan's name, and its address. Migration 17 holds the same rule as a
 * CHECK (`clan_name_ok`) and makes the same slug (`clan_slug`); the site
 * checks first, to answer with a sentence rather than a code.
 *
 * - A name is 1-20 letters and digits with single spaces between them.
 * - Names like "Clan 123" are kept for staff: hiding a clan renames it so.
 *   A clan may keep such a name when it saves its page, but no one may
 *   choose one; the database tells the two apart (it knows the old name).
 * - The slug is the name lower-cased with each space a dash, and unique;
 *   renaming a clan changes its address and the old one 404s.
 */

export const CLAN_LIMITS = {
  name: 20,
  motto: 80,
  about: 600,
  noticeTitle: 40,
  // Short, like a log's updates (sprint 6; migration 18's clan_notice_post caps at the same).
  noticeBody: 200,
  members: 50,
  invites: 20,
} as const;

const NAME = /^[A-Za-z0-9]( ?[A-Za-z0-9])*$/;
const RESERVED = /^clan [0-9]+$/i;
const SLUG = /^[a-z0-9](-?[a-z0-9])*$/;

/** The length and the characters only: a name a clan may keep, a staff "Clan 123" included. */
export function clanNameShapeOk(name: string): boolean {
  return name.length >= 1 && name.length <= CLAN_LIMITS.name && NAME.test(name);
}

/** A name a player may choose: the shape, and not one kept for staff. */
export function clanNameOk(name: string): boolean {
  return clanNameShapeOk(name) && !RESERVED.test(name);
}

export function clanSlug(name: string): string {
  return name.toLowerCase().replace(/ /g, "-");
}

/**
 * The slug a `[slug]` URL segment names, or null when no clan could have
 * it. Case and spaces are forgiven (`Varrock%20Knights` is
 * `varrock-knights`), the way a log's name is, so one clan has one page:
 * slugs are stored lower-case and `clan_page` matches them exactly.
 */
export function slugFrom(raw: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }
  const slug = decoded.trim().toLowerCase().replace(/ /g, "-");
  return slug.length <= CLAN_LIMITS.name && SLUG.test(slug) ? slug : null;
}
