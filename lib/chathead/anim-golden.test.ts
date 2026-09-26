import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { beforeAll, describe, expect, it } from "vitest";

import { type Clip, emoteClip, moodClip } from "./animate";
import golden from "./anim-golden.json";
import { decodeAnims, loadAnims } from "./anims-file";
import animsJson from "./anims.json";
import type { AnimTables } from "./anims";
import { decodeBodies, loadBodies } from "./bodies-file";
import bodiesJson from "./bodies.json";
import type { BodyTables } from "./body";
import type { Client } from "./client";
import { BACKGROUND } from "./draw";
import figure from "./figure.json";
import type { HeadTables } from "./head";
import headsJson from "./heads.json";
import { type Look, lookKey } from "./look";
import { decodeModels, loadModels } from "./models";
import type { Emote, Mood } from "./vocab";

/**
 * Every golden frame, drawn the way a page draws it — the committed
 * `renderer.js`, `bodies.bin`, `models.bin` and `anims.bin`, their tables,
 * and `animate.ts` — must match, pixel for pixel, what the client's own
 * classes drew when `npm run chathead:update` wrote `anim-golden.json`: an
 * emote's frame by `ClientPlayer.getTempModel2` with the emote as the
 * player's primary seq, a mood's by `IfType.getTempModel` for a dialogue's
 * head. Between them the frames cover waving in every whole outfit (hands
 * emptied), every frame of every emote, and every pair of frames any mood
 * poses a head with (`frames` and `iframes`).
 *
 * The reference loaded every anim file in the cache whole, so a frame the
 * cut `anims.bin` leaves out fails here as surely as a wrong assembly.
 */

const anims = animsJson as unknown as AnimTables;
const bodyTables = bodiesJson as unknown as BodyTables;
const headTables = headsJson as HeadTables;
const PUBLIC = path.join(__dirname, "../../public/game/chathead");

let client: Client;

beforeAll(async () => {
  client = (await import(
    pathToFileURL(path.join(PUBLIC, "renderer.js")).href
  )) as Client;
  // A page with a figure and a chathead loads all three, in any order; the
  // figure's first (it builds the colour table after the textures, as the
  // build did).
  loadBodies(client, decodeBodies(readFileSync(path.join(PUBLIC, "bodies.bin"))));
  loadModels(client, decodeModels(readFileSync(path.join(PUBLIC, "models.bin"))));
  loadAnims(client, decodeAnims(readFileSync(path.join(PUBLIC, "anims.bin"))));
});

function hash(pixels: Int32Array | null | undefined): string | null {
  if (!pixels || pixels.every((rgb) => rgb === BACKGROUND)) return null;
  return createHash("sha256")
    .update(new Uint8Array(pixels.buffer))
    .digest("hex")
    .slice(0, 16);
}

/** One clip per look and seq, however many of its frames are checked. */
function cached(clips: Map<string, Clip | null>, key: string, draw: () => Clip | null) {
  if (!clips.has(key)) clips.set(key, draw());
  return clips.get(key)!;
}
const emoteClips = new Map<string, Clip | null>();
const moodClips = new Map<string, Clip | null>();

describe("clips play as the client plays them", () => {
  const MAN: Look = {
    gender: 0,
    kits: [0, 10, 18, 26, 33, 36, 42],
    colours: [0, 0, 0, 0, 0],
    worn: new Array(14).fill(-1),
  };

  it("an emote holds each frame for its delay, once", () => {
    const clip = emoteClip(client, bodyTables, anims, MAN, "wave", figure.frame)!;
    expect(clip.frames).toHaveLength(anims.emotes.wave.frames.length);
    expect(clip.delays).toEqual(anims.emotes.wave.delays);
    expect(clip.loop).toBeNull();
  });

  it("a mood holds each frame a cycle past its delay, and loops its tail", () => {
    const seq = anims.moods.happy[1];
    const clip = moodClip(client, headTables, anims, MAN, "happy", 2)!;
    expect(clip.frames).toHaveLength(seq.frames.length);
    expect(clip.delays).toEqual(seq.delays.map((delay) => delay + 1));
    // chathap2: 64 frames, back 12 after the last.
    expect([seq.frames.length, seq.loops, clip.loop]).toEqual([64, 12, 52]);
    // evilidle1 steps back over all 17 frames: the whole seq repeats.
    expect(moodClip(client, headTables, anims, MAN, "verymad", 1)!.loop).toBe(0);
  });

  it("a mood picks its seq by the page's line count, one to four", () => {
    const length = (lines: number) =>
      moodClip(client, headTables, anims, MAN, "neutral", lines)!.frames.length;
    const lens = anims.moods.neutral.map((seq) => seq.frames.length);
    expect([0, 1, 2, 3, 4, 9].map(length)).toEqual([
      lens[0], lens[0], lens[1], lens[2], lens[3], lens[3],
    ]);
  });
});

describe("golden animation frames", () => {
  it("were drawn from the same build as the tables", () => {
    expect(golden.version).toBe(anims.version);
    expect(golden.emotes.length).toBeGreaterThan(80);
    expect(golden.moods.length).toBeGreaterThan(900);
  });

  it.each(
    golden.emotes.map((entry) => [entry.name, entry.emote, entry.frame, entry] as const),
  )("%s, %s, frame %i", (_name, emote, frame, entry) => {
    const look = entry.look as Look;
    const clip = cached(emoteClips, `${lookKey(look)}/${emote}`, () =>
      emoteClip(client, bodyTables, anims, look, emote as Emote, figure.frame),
    );
    expect(hash(clip?.frames[frame])).toBe(entry.hash);
  });

  it.each(
    golden.moods.map((entry) => [entry.name, entry.mood, entry.lines, entry.frame, entry] as const),
  )("%s, %s over %i lines, frame %i", (_name, mood, lines, frame, entry) => {
    const look = entry.look as Look;
    const clip = cached(moodClips, `${lookKey(look)}/${mood}/${lines}`, () =>
      moodClip(client, headTables, anims, look, mood as Mood, lines),
    );
    expect(hash(clip?.frames[frame])).toBe(entry.hash);
  });
});
