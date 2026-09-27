import type { AnimTables } from "../../lib/chathead/anims.ts";
import type { Pose } from "../../lib/chathead/body.ts";
import type { Look } from "../../lib/chathead/look.ts";

/**
 * The reference looks and poses a figure is proved in - every scene at
 * every facing (`render.ts`) - and measured in for the turn frame
 * (`scripts/chathead/bodies.ts`). Plain data: importing it registers no bun
 * plugin, so the chathead build can use it.
 */

/** The game's new-player look (`Player.body`), wearing nothing. */
export const REFERENCE: Look = {
  gender: 0,
  kits: [0, 10, 18, 26, 33, 36, 42],
  colours: [0, 0, 0, 0, 0],
  worn: new Array<number>(14).fill(-1),
};

/**
 * The same player geared up well past that outline: a rune full helm (0),
 * a red cape (1), a rune two-handed sword (3), a rune platebody (4) and
 * platelegs (7), by `wearpos`. A player's own outfit can be wider or taller
 * than the default, so each spot is proved with this one too.
 */
export const BULKY: Look = {
  ...REFERENCE,
  worn: [1163, 1007, -1, 1319, 1127, -1, -1, 1079, -1, -1, -1, -1, -1, -1],
};

/**
 * The game's new-player look as a woman (`Player.body` for gender 1): a
 * different outline again - at canifis it reached what the man's did not.
 */
export const WOMAN: Look = {
  gender: 1,
  kits: [45, -1, 56, 61, 67, 70, 79],
  colours: [0, 0, 0, 0, 0],
  worn: new Array<number>(14).fill(-1),
};

/**
 * The default look in an iron chainbody (4), whose see-through faces the
 * game blends with what is behind them. Proves that the site draws a figure
 * onto the backdrop, not alone and laid over it: that differs here, and
 * only here.
 */
export const CHAINBODY: Look = {
  ...REFERENCE,
  worn: [-1, -1, -1, -1, 1101, -1, -1, -1, -1, -1, -1, -1, -1, -1],
};

/**
 * The looks every spot is proved with, named for the build's errors and
 * written into `lib/scenes/composite-golden.json` by these names.
 */
export const LOOKS: { name: string; look: Look }[] = [
  { name: "the default look", look: REFERENCE },
  { name: "the bulky look", look: BULKY },
  { name: "the woman's look", look: WOMAN },
  { name: "the chainbody look", look: CHAINBODY },
];

/** A pose with its name for the build's messages: "standing", or "dance frame 2305". */
export type NamedPose = { name: string; emote: string | null; pose?: Pose };

/**
 * Every pose the card can draw a figure in: standing, and every frame of
 * every emote (`lib/chathead/anims.json`, what the site plays), each with
 * the hands its seq empties. A frame emotes share with the same hands is
 * one pose, named for the first. 73 today.
 */
export function figurePoses(emotes: AnimTables["emotes"]): NamedPose[] {
  const poses: NamedPose[] = [{ name: "standing", emote: null }];
  const posed = new Set<string>();
  for (const [emote, seq] of Object.entries(emotes)) {
    for (const frame of seq.frames) {
      const id = `${frame}:${seq.hideLeft}:${seq.hideRight}`;
      if (posed.has(id)) continue;
      posed.add(id);
      poses.push({ name: `${emote} frame ${frame}`, emote, pose: { frame, hideLeft: seq.hideLeft, hideRight: seq.hideRight } });
    }
  }
  return poses;
}
