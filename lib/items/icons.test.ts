import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import manifest from "./icons.json";
import names from "./names.json";
import { itemIconSrc } from "./icons";

const PUBLIC = path.join(__dirname, "../../public");
const ITEMS = path.join(PUBLIC, "img/game/items");

/**
 * The icons are generated files, so what matters is that the manifest and the
 * folder agree — `itemIconSrc` promises a URL only where a file is — and that
 * every item a page can name also has a picture, apart from the placeholders
 * the client draws as nothing.
 */

describe("itemIconSrc", () => {
  it("finds coins and a note", () => {
    expect(itemIconSrc(995)).toBe("/img/game/items/995.png");
    expect(itemIconSrc(1278)).toBe("/img/game/items/1278.png"); // bronze sword, noted
  });

  it("has nothing for ids outside the pack", () => {
    expect(itemIconSrc(-1)).toBeNull();
    expect(itemIconSrc(1.5)).toBeNull();
    expect(itemIconSrc(manifest.count)).toBeNull();
  });

  it("has nothing for the client's blank placeholders", () => {
    // invis_ring1: an interface stand-in whose model is `floor_invisableicon_0`.
    expect(manifest.blank).toContain(1649);
    expect(itemIconSrc(1649)).toBeNull();
  });

  it("points only at files that exist, and at every file", () => {
    const files = new Set(readdirSync(ITEMS));
    let promised = 0;
    for (let id = 0; id < manifest.count; id++) {
      const src = itemIconSrc(id);
      expect(files.has(`${id}.png`), `item ${id}`).toBe(src !== null);
      if (src) promised++;
    }
    expect(files.size).toBe(promised);
  });

  it("has an icon for every named item but the placeholders", () => {
    const blank = new Set(manifest.blank);
    for (const key of Object.keys(names)) {
      const id = Number(key);
      if (blank.has(id)) continue;
      expect(itemIconSrc(id), `item ${id} (${key})`).not.toBeNull();
      expect(existsSync(path.join(PUBLIC, itemIconSrc(id)!))).toBe(true);
    }
  });
});
