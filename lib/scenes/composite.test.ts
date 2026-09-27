import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { beforeAll, describe, expect, it } from "vitest";

import { type Clip, emoteClip } from "@/lib/chathead/animate";
import type { AnimTables } from "@/lib/chathead/anims";
import { decodeAnims, loadAnims } from "@/lib/chathead/anims-file";
import animsJson from "@/lib/chathead/anims.json";
import { decodeBodies, loadBodies } from "@/lib/chathead/bodies-file";
import bodiesJson from "@/lib/chathead/bodies.json";
import type { BodyTables } from "@/lib/chathead/body";
import type { Client } from "@/lib/chathead/client";
import { type Look, lookKey } from "@/lib/chathead/look";
import type { Emote } from "@/lib/chathead/vocab";

import golden from "./composite-golden.json";
import { decodeBackdrop, drawAtEye, drawAtSpot, sceneFrame } from "./draw";
import { SCENES, type SceneSpot, sceneOf } from "./spots";

/**
 * A figure standing in a scene, drawn the way a page draws it - the
 * committed `renderer.js`, `bodies.bin` and `anims.bin`, the committed
 * backdrop PNG decoded as the page decodes it, and `draw.ts` - must match,
 * pixel for pixel, the composite `npm run scenes:update` proved against the
 * game's own picture of the scene with the figure in it (`addDynamic` and
 * `renderAll` in one pass, `scripts/scenes/render.ts`), and wrote to
 * `composite-golden.json`.
 *
 * The build drew with Client-TS's source and its far clip pushed out
 * (`scripts/scenes/far.ts`); `renderer.js` is the game's own, unpatched.
 * A figure is always well inside the game's far clip (the build refuses
 * one that is not), and this is where that is held to: every look the build
 * proves with, in every pose the card plays, at the first spot, and every
 * look standing at every other spot - which also checks each spot's eye and
 * figure numbers in `spots.json` against the ones it drew with.
 */

const anims = animsJson as unknown as AnimTables;
const bodyTables = bodiesJson as unknown as BodyTables;
const looks = golden.looks as Record<string, Look>;
const PUBLIC = path.join(__dirname, "../../public/game");

let client: Client;
const backdrops = new Map<string, Int32Array>();

beforeAll(async () => {
  client = (await import(
    pathToFileURL(path.join(PUBLIC, "chathead/renderer.js")).href
  )) as Client;
  loadBodies(client, decodeBodies(readFileSync(path.join(PUBLIC, "chathead/bodies.bin"))));
  loadAnims(client, decodeAnims(readFileSync(path.join(PUBLIC, "chathead/anims.bin"))));
  for (const spot of SCENES.spots) {
    const png = new Uint8Array(readFileSync(path.join(PUBLIC, `scenes/${spot.key}.png`)));
    backdrops.set(spot.key, await decodeBackdrop(png, spot));
  }
});

function hash(pixels: Int32Array | null | undefined): string | null {
  if (!pixels) return null;
  return createHash("sha256")
    .update(new Uint8Array(pixels.buffer, pixels.byteOffset, pixels.byteLength))
    .digest("hex")
    .slice(0, 16);
}

/** One clip per spot, look and emote, however many of its frames are checked. */
const clips = new Map<string, Clip | null>();
function clipAt(spot: SceneSpot, look: Look, emote: Emote): Clip | null {
  const key = `${spot.key}/${lookKey(look)}/${emote}`;
  if (!clips.has(key)) {
    const backdrop = backdrops.get(spot.key)!;
    clips.set(
      key,
      emoteClip(client, bodyTables, anims, look, emote, sceneFrame(spot), (body) =>
        drawAtEye(client, body, spot, backdrop),
      ),
    );
  }
  return clips.get(key)!;
}

describe("backdrops", () => {
  it("decode to their spot's size, with the figure's spot drawn over them", () => {
    for (const spot of SCENES.spots) {
      const backdrop = backdrops.get(spot.key)!;
      expect(backdrop).toHaveLength(spot.width * spot.height);
      const drawn = drawAtSpot(client, bodyTables, looks["the default look"], spot, backdrop)!;
      // The backdrop is copied, never drawn on.
      expect(drawn).not.toBe(backdrop);
      expect(drawn.some((rgb, i) => rgb !== backdrop[i])).toBe(true);
    }
  });

  it("refuse a PNG of another size", async () => {
    const png = new Uint8Array(readFileSync(path.join(PUBLIC, `scenes/${SCENES.spots[0].key}.png`)));
    await expect(decodeBackdrop(png, { width: 120, height: 300 })).rejects.toThrow(/240x300/);
  });
});

describe("golden composites", () => {
  it("were drawn from the same build as the scenes, the bodies and the emotes", () => {
    expect(golden.version).toBe(SCENES.version);
    expect(golden.bodies).toBe(bodyTables.version);
    expect(golden.anims).toBe(anims.version);
    // Every look standing at every spot, and more than that at the first.
    const standing = golden.draws.filter((draw) => draw.emote === null);
    expect(standing).toHaveLength(SCENES.spots.length * Object.keys(looks).length);
    expect(golden.draws.length).toBeGreaterThan(200);
  });

  it.each(
    golden.draws.map((draw) => [draw.spot, draw.look, draw.emote ?? "standing", draw.frame ?? "", draw] as const),
  )("%s: %s, %s %s", (key, lookName, _emote, _frame, draw) => {
    const spot = sceneOf(key)!;
    const look = looks[lookName];
    let pixels: Int32Array | null | undefined;
    if (draw.emote === null) {
      pixels = drawAtSpot(client, bodyTables, look, spot, backdrops.get(key)!);
    } else {
      const emote = draw.emote as Emote;
      const index = anims.emotes[emote].frames.indexOf(draw.frame!);
      expect(index).toBeGreaterThanOrEqual(0);
      pixels = clipAt(spot, look, emote)?.frames[index];
    }
    expect(hash(pixels)).toBe(draw.hash);
  });
});
