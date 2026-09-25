import manifest from "./tiles.json";

/**
 * The menu tiles drawn from the game.
 *
 * Most of `/title`'s pictures are 2004's own, vendored into
 * `public/img/title/`. Three pages had no tile Jagex ever drew — LostHQ,
 * Zanaris Kit and the Adventurer Logs — so those are posed from an object's
 * model by
 * `scripts/game-icons/render.ts`, which writes this manifest beside them.
 *
 * Pure and committed, like `lib/items/icons.ts`: a render never depends on
 * the engine being checked out next to this repository.
 */

/**
 * The version the generator stamped on this set: a hash of its bytes, carried
 * by every URL. `next.config.ts` caches everything under /img/game for a year
 * as `immutable`, which is only safe because redrawing a tile changes the
 * version and so changes the URL — nothing can purge a browser cache.
 */
const VERSION: string = manifest.version;

const NAMES: ReadonlySet<string> = new Set(manifest.names);

/** The tile's URL, or `null` for a name the generator never drew. */
export function titleTileSrc(name: string): string | null {
  return NAMES.has(name) ? `/img/game/tiles/${name}.png?v=${VERSION}` : null;
}
