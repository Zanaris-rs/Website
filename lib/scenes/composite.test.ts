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
 * `composite-golden.json`, at every facing it proved.
 *
 * The build drew with Client-TS's source and its far clip pushed out
 * (`scripts/scenes/far.ts`); `renderer.js` is the game's own, unpatched.
 * A figure is always well inside the game's far clip (the build refuses
 * one that is not), and this is where that is held to: every look the build
 * proves with, in every pose the card plays, at the first spot facing the
 * camera, the default look in every pose at every facing the first spot
 * proved, and every look standing at every proved facing of every spot -
 * which also checks each spot's eye, figure and turns in `spots.json`
 * against the ones it drew with.
 */

const anims = animsJson as unknown as AnimTables;
const bodyTables = bodiesJson as unknown as BodyTables;
const looks = golden.looks as Record<string, Look>;
const turns = golden.turns as Record<string, number[]>;
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

/**
 * The clip the draws being checked come from. They come a clip at a time
 * (by facing, look and emote), so only the last is kept: every clip at
 * once would be most of a gigabyte of frames.
 */
let last: { key: string; clip: Clip | null } | null = null;
function clipAt(spot: SceneSpot, look: Look, emote: Emote, facing: number): Clip | null {
  const key = `${spot.key}/${lookKey(look)}/${facing}/${emote}`;
  if (last?.key !== key) {
    const backdrop = backdrops.get(spot.key)!;
    last = {
      key,
      clip: emoteClip(client, bodyTables, anims, look, emote, sceneFrame(spot), (body) =>
        drawAtEye(client, body, spot, backdrop, facing),
      ),
    };
  }
  return last.clip;
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
    // Every look standing at every spot facing the camera, and more than that at the first.
    const facingCamera = golden.draws.filter((draw) => draw.emote === null && draw.facing === 0);
    expect(facingCamera).toHaveLength(SCENES.spots.length * Object.keys(looks).length);
    expect(golden.draws.length).toBeGreaterThan(200);
  });

  it("record every look in every pose facing the camera at the first spot, and the default look at its every other facing", () => {
    const [first] = SCENES.spots;
    const names = Object.keys(looks);
    /** The emote frames recorded for a look at a facing of the first spot, in the build's order. */
    const posed = (name: string, facing: number) =>
      golden.draws
        .filter((draw) => draw.spot === first.key && draw.look === name && draw.facing === facing && draw.emote !== null)
        .map((draw) => `${draw.emote} ${draw.frame}`);

    // Facing the camera, every look in the same poses: every frame of every emote.
    const poses = posed("the default look", 0);
    expect(poses.length).toBeGreaterThan(0);
    for (const name of names) expect(posed(name, 0)).toEqual(poses);

    // Turned, the default look in all of them at every facing the spot proved, and no other look.
    const turned = first.turns.filter((facing) => facing !== 0);
    expect(turned.length).toBeGreaterThan(0);
    for (const facing of turned) {
      expect(posed("the default look", facing)).toEqual(poses);
      for (const name of names.filter((other) => other !== "the default look")) {
        expect(posed(name, facing)).toEqual([]);
      }
    }

    // Nothing else: every look standing at every proved facing of every spot, and those poses.
    const standing = SCENES.spots.reduce((total, spot) => total + spot.turns.length * names.length, 0);
    const emotes = poses.length * (names.length + turned.length);
    expect(golden.draws).toHaveLength(standing + emotes);
    expect(golden.draws.filter((draw) => draw.emote !== null && draw.spot !== first.key)).toEqual([]);
  });

  it("record every facing each spot proved, as spots.json turns through them", () => {
    for (const spot of SCENES.spots) {
      expect(turns[spot.key]).toEqual(spot.turns);
      for (const name of Object.keys(looks)) {
        const standing = golden.draws
          .filter((draw) => draw.spot === spot.key && draw.look === name && draw.emote === null)
          .map((draw) => draw.facing);
        expect(standing).toEqual(spot.turns);
      }
    }
  });

  it.each(
    golden.draws.map(
      (draw) => [draw.spot, draw.look, draw.facing, draw.emote ?? "standing", draw.frame ?? "", draw] as const,
    ),
  )("%s: %s facing %i, %s %s", (key, lookName, facing, _emote, _frame, draw) => {
    const spot = sceneOf(key)!;
    const look = looks[lookName];
    let pixels: Int32Array | null | undefined;
    if (draw.emote === null) {
      pixels = drawAtSpot(client, bodyTables, look, spot, backdrops.get(key)!, undefined, facing);
    } else {
      const emote = draw.emote as Emote;
      const index = anims.emotes[emote].frames.indexOf(draw.frame!);
      expect(index).toBeGreaterThanOrEqual(0);
      pixels = clipAt(spot, look, emote, facing)?.frames[index];
    }
    expect(hash(pixels)).toBe(draw.hash);
  });
});
