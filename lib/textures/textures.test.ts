import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import manifest from "./textures.json";
import { TEXTURES, textureSrc } from "./textures";

const PUBLIC = path.join(__dirname, "../../public");
const DIR = path.join(PUBLIC, "img/game/textures");

/**
 * Generated files, so what matters is that the manifest and the folder agree,
 * and that every URL carries the version: /img/game is cached for a year as
 * `immutable`.
 */

describe("textures", () => {
  it("are the pack's fifty, each named and square", () => {
    expect(TEXTURES.map((texture) => texture.id)).toEqual(Array.from({ length: 50 }, (_, id) => id));
    for (const texture of TEXTURES) {
      expect(texture.name, String(texture.id)).toMatch(/^[a-z0-9_]+$/);
      expect([64, 128]).toContain(texture.size);
    }
    expect(TEXTURES.find((texture) => texture.id === 1)?.name).toBe("water");
  });

  it("was stamped with a version the generator wrote", () => {
    expect(manifest.version).toMatch(/^[0-9a-f]{8}$/);
    expect(textureSrc(24)).toBe(`/img/game/textures/24.png?v=${manifest.version}`);
  });

  it("has nothing for an id the pack does not have", () => {
    expect(textureSrc(50)).toBeNull();
    expect(textureSrc(-1)).toBeNull();
    expect(textureSrc(1.5)).toBeNull();
  });

  it("points only at files that exist, and at every file", () => {
    expect(readdirSync(DIR).length).toBe(TEXTURES.length);
    for (const texture of TEXTURES) {
      expect(existsSync(path.join(PUBLIC, textureSrc(texture.id)!.split("?")[0])), texture.name).toBe(true);
    }
  });
});
