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

/** The icon's URL, or `null` for an id with no icon to show. */
export function itemIconSrc(id: number): string | null {
  if (!Number.isInteger(id) || id < 0 || id >= COUNT || BLANK.has(id))
    return null;
  return `/img/game/items/${id}.png`;
}

/** Every icon is this square; the client's inventory grid is too. */
export const ITEM_ICON_SIZE = 32;
