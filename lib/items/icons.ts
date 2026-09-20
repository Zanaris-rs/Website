import manifest from "./icons.json";

/**
 * Item ids as icons.
 *
 * `public/img/game/items/<id>.png` is the 32x32 inventory icon the game
 * client draws for that object — drawn by the client's own renderer, from
 * the engine's pack, by `scripts/update-game-icons.sh`. That script's header
 * says how. `icons.json` is its record of what it drew: the pack's object
 * count, and the few ids inside it the client draws as nothing (invisible
 * placeholder models), which have no file.
 *
 * Like `names.ts`, this is pure and committed: a render never depends on the
 * engine being checked out next to this repository.
 */

const COUNT: number = manifest.count;
const BLANK: ReadonlySet<number> = new Set(manifest.blank);

/**
 * The version the generator stamped on this set of icons: a hash of their
 * bytes, carried by every URL. The files are named by object id rather than
 * by their contents, so an id's picture does change when its model does.
 * The version is what lets `next.config.ts` cache them for a year and still
 * have a regeneration reach a reader who is holding the old one — nothing
 * can purge a browser cache, but a new URL sidesteps it.
 */
const VERSION: string = manifest.version;

/** The icon's URL, or `null` for an id with no icon to show. */
export function itemIconSrc(id: number): string | null {
  if (!Number.isInteger(id) || id < 0 || id >= COUNT || BLANK.has(id))
    return null;
  return `/img/game/items/${id}.png?v=${VERSION}`;
}

/** Every icon is this square; the client's inventory grid is too. */
export const ITEM_ICON_SIZE = 32;
