import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { beforeAll, describe, expect, it } from "vitest";

import { decodeBodies, loadBodies } from "@/lib/chathead/bodies-file";
import bodiesJson from "@/lib/chathead/bodies.json";
import { type BodyTables, buildBody } from "@/lib/chathead/body";
import type { Client } from "@/lib/chathead/client";
import type { Look } from "@/lib/chathead/look";

import golden from "./composite-golden.json";
import { decodeBackdrop, renderAtEye, sceneCanvas } from "./draw";
import { drawPhoto, drawPlacedPhoto, type PlacedSitter, photoSlots, photoSpot, projectSitter } from "./photo";
import { type PhotoSlot, SCENES, type SceneSpot, sceneOf } from "./spots";

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

describe("drawPlacedPhoto", () => {
  const looks = Object.entries(golden.looks as Record<string, Look>);

  /** The pixels a drawing changed in the backdrop: their bounds, inclusive. */
  function drawnBounds(pixels: Int32Array, backdrop: Int32Array, width: number) {
    let left = Infinity;
    let top = Infinity;
    let right = -1;
    let bottom = -1;
    for (let i = 0; i < pixels.length; i++) {
      if (pixels[i] === backdrop[i]) continue;
      const x = i % width;
      const y = Math.floor(i / width);
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
    return { left, top, right, bottom };
  }

  /** The box holds the drawing, at most a pixel bigger each way, and the chat hangs over the top of the head. */
  function expectPlacedOn({ head, box }: PlacedSitter, drawn: ReturnType<typeof drawnBounds>, where: string) {
    expect(box.x, where).toBeLessThanOrEqual(drawn.left);
    expect(box.y, where).toBeLessThanOrEqual(drawn.top);
    expect(box.x + box.w - 1, where).toBeGreaterThanOrEqual(drawn.right);
    expect(box.y + box.h - 1, where).toBeGreaterThanOrEqual(drawn.bottom);
    expect(drawn.left - box.x, where).toBeLessThanOrEqual(1);
    expect(drawn.top - box.y, where).toBeLessThanOrEqual(1);
    expect(box.x + box.w - 1 - drawn.right, where).toBeLessThanOrEqual(1);
    expect(box.y + box.h - 1 - drawn.bottom, where).toBeLessThanOrEqual(1);
    expect(Math.abs(head.y - drawn.top), where).toBeLessThanOrEqual(1);
    expect(head.x, where).toBeGreaterThanOrEqual(drawn.left);
    expect(head.x, where).toBeLessThanOrEqual(drawn.right);
  }

  /** `look` drawn alone on `slot`, as the renderer draws it: where its pixels are. */
  function drawnAlone(spot: SceneSpot, backdrop: Int32Array, look: Look, slot: PhotoSlot) {
    const pixels = sceneCanvas(client, spot, backdrop);
    renderAtEye(client, buildBody(client, bodyTables, look)!, spot, slot, slot.yaw);
    return drawnBounds(pixels, backdrop, spot.width);
  }

  it("places each golden look, alone in each slot of every photo, on the pixels the renderer drew", () => {
    for (const spot of SCENES.spots) {
      if (!spot.photo) continue;
      const backdrop = backdrops.get(spot.key)!;
      for (const [name, look] of looks) {
        for (const slot of photoSlots(spot, spot.photo.length)) {
          const pixels = sceneCanvas(client, spot, backdrop);
          const body = buildBody(client, bodyTables, look)!;
          const placed = projectSitter(client.Pix3D, spot, slot, body);
          renderAtEye(client, body, spot, slot, slot.yaw);
          const where = `${spot.key} ${name} at ${slot.x},${slot.z}`;
          expectPlacedOn(placed, drawnBounds(pixels, backdrop, spot.width), where);
        }
      }
    }
  });

  it("draws the build's proven picture, and places each of a row where the renderer draws it", () => {
    const spot = photoSpot(null);
    const backdrop = backdrops.get(spot.key)!;
    // The picture is the one the build proved: the bulky look in every slot.
    const proven = golden.photos.find((photo) => photo.spot === spot.key)!;
    const full = drawPlacedPhoto(client, bodyTables, spot, backdrop, Array.from({ length: proven.count }, () => bulky));
    expect(hash(full.pixels)).toBe(proven.hash);
    expect(full.placed).toHaveLength(proven.count);

    // A row of different looks: each is placed where the renderer draws that
    // look alone on its slot, whatever was drawn or built before or after it.
    const row = looks.map(([, look]) => look).concat(bulky);
    const slots = photoSlots(spot, row.length);
    const { placed } = drawPlacedPhoto(client, bodyTables, spot, backdrop, row);
    expect(placed).toHaveLength(row.length);
    row.forEach((look, i) => expectPlacedOn(placed[i], drawnAlone(spot, backdrop, look, slots[i]), `sitter ${i}`));
    for (let i = 1; i < placed.length; i++) expect(placed[i].head.x).toBeGreaterThan(placed[i - 1].head.x);
    expect(drawPlacedPhoto(client, bodyTables, spot, backdrop, []).placed).toEqual([]);
  });
});
