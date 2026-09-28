import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { beforeAll, describe, expect, it } from "vitest";

import { decodeBodies, loadBodies } from "@/lib/chathead/bodies-file";
import bodiesJson from "@/lib/chathead/bodies.json";
import type { BodyTables } from "@/lib/chathead/body";
import type { Client } from "@/lib/chathead/client";
import type { Look } from "@/lib/chathead/look";

import golden from "./composite-golden.json";
import { decodeBackdrop } from "./draw";
import { drawPhoto, photoSpot } from "./photo";
import { SCENES, sceneOf } from "./spots";

/**
 * A clan photo drawn the way a page draws it - the committed `renderer.js`
 * and `bodies.bin`, the committed backdrop decoded as the page decodes it,
 * and `drawPhoto` - must match, pixel for pixel, the photo
 * `npm run scenes:update` proved against the game's own picture of the
 * same looks added to the world in one pass, and wrote to
 * `composite-golden.json`'s `photos`.
 */

const bodyTables = bodiesJson as unknown as BodyTables;
const bulky = (golden.looks as Record<string, Look>)["the bulky look"];
const PUBLIC = path.join(__dirname, "../../public/game");

let client: Client;
const backdrops = new Map<string, Int32Array>();

beforeAll(async () => {
  client = (await import(pathToFileURL(path.join(PUBLIC, "chathead/renderer.js")).href)) as Client;
  loadBodies(client, decodeBodies(readFileSync(path.join(PUBLIC, "chathead/bodies.bin"))));
  for (const spot of SCENES.spots) {
    if (!spot.photo) continue;
    const png = new Uint8Array(readFileSync(path.join(PUBLIC, `scenes/${spot.key}.png`)));
    backdrops.set(spot.key, await decodeBackdrop(png, spot));
  }
});

function hash(pixels: Int32Array): string {
  return createHash("sha256")
    .update(new Uint8Array(pixels.buffer, pixels.byteOffset, pixels.byteLength))
    .digest("hex")
    .slice(0, 16);
}

describe("photoSpot", () => {
  it("is the Leader's scene when it holds a photo, else Varrock square", () => {
    expect(photoSpot(null).key).toBe("varrock");
    expect(photoSpot("zanaris").key).toBe("varrock");
    for (const spot of SCENES.spots) {
      expect(photoSpot(spot.key).key).toBe(spot.photo?.length ? spot.key : "varrock");
    }
  });
});

describe("drawPhoto", () => {
  it("has a golden for every spot with slots, from the same build", () => {
    expect(golden.version).toBe(SCENES.version);
    expect(golden.photos.map((photo) => photo.spot)).toEqual(
      SCENES.spots.filter((spot) => spot.photo).map((spot) => spot.key),
    );
  });

  it.each(golden.photos.map((photo) => [photo.spot, photo.count, photo.hash] as const))(
    "%s: the bulky look in all %i slots is the build's proven picture",
    (key, count, expected) => {
      const spot = sceneOf(key)!;
      expect(spot.photo).toHaveLength(count);
      const looks = Array.from({ length: count }, () => bulky);
      expect(hash(drawPhoto(client, bodyTables, spot, backdrops.get(key)!, looks))).toBe(expected);
    },
  );

  it("draws nobody as a copy of the backdrop, and refuses more sitters than slots", () => {
    const spot = photoSpot(null);
    const backdrop = backdrops.get(spot.key)!;
    const empty = drawPhoto(client, bodyTables, spot, backdrop, []);
    expect(empty).not.toBe(backdrop);
    expect(empty).toEqual(backdrop);
    expect(() => drawPhoto(client, bodyTables, spot, backdrop, Array.from({ length: 8 }, () => bulky))).toThrow();
  });
});
