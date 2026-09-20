import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import manifest from "./tiles.json";
import { titleTileSrc } from "./tiles";

const PUBLIC = path.join(__dirname, "../../public");
const TILES = path.join(PUBLIC, "img/game/tiles");

/**
 * The tiles are generated files, so what matters is that the manifest, the
 * folder and the page agree: `/title` asks for two names by hand, and a name
 * the generator stopped drawing would leave that tile with no picture.
 *
 * The version matters for the same reason it does for the icons: /img/game is
 * cached for a year as `immutable`, so a URL without a `?v=` could never be
 * corrected.
 */

describe("titleTileSrc", () => {
  it("gives the two tiles /title asks for, stamped with the version", () => {
    for (const name of ["sextant", "dramen-staff"]) {
      expect(titleTileSrc(name)).toBe(
        `/img/game/tiles/${name}.png?v=${manifest.version}`,
      );
    }
  });

  it("was stamped with a version the generator wrote", () => {
    expect(manifest.version).toMatch(/^[0-9a-f]{8}$/);
  });

  it("has nothing for a name that was never drawn", () => {
    expect(titleTileSrc("book-of-binding")).toBeNull();
    expect(titleTileSrc("")).toBeNull();
  });

  it("points only at files that exist, and at every file", () => {
    const files = new Set(readdirSync(TILES));
    expect(files.size).toBe(manifest.names.length);
    for (const name of manifest.names) {
      const src = titleTileSrc(name);
      expect(src, name).not.toBeNull();
      expect(existsSync(path.join(PUBLIC, src!.split("?")[0])), name).toBe(
        true,
      );
    }
  });
});
