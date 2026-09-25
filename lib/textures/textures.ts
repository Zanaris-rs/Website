import manifest from "./textures.json";

/**
 * The game's textures as pictures: the fifty the 2004 client paints walls,
 * roofs, water and trees with, one PNG per texture id at its own size (128
 * square, a few 64), with the client's holes left transparent.
 *
 * `scripts/update-game-textures.sh` writes them and this manifest from the
 * engine's pack. They are here for Adventurer Log stylesheets, whose picker
 * offers them as backgrounds. Pure and committed, like `lib/items/icons.ts`.
 */

export type Texture = {
  readonly id: number;
  /** The content's name for it (`texture.pack`), or "" when it had none. */
  readonly name: string;
  /** Width and height in pixels. */
  readonly size: number;
};

export const TEXTURES: readonly Texture[] = manifest.textures;

const IDS: ReadonlySet<number> = new Set(TEXTURES.map((texture) => texture.id));

/**
 * The version the generator stamped on the set, carried by every URL: the
 * same scheme as `lib/items/icons.ts`, which explains it.
 */
const VERSION: string = manifest.version;

/** The texture's URL, or `null` for an id the pack has no texture for. */
export function textureSrc(id: number): string | null {
  return IDS.has(id) ? `/img/game/textures/${id}.png?v=${VERSION}` : null;
}
