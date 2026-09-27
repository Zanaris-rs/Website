import type { AnimTables, SeqClip } from "./anims.ts";
import { type BodyTables, buildBody, FIGURE_CAMERA, type Pose } from "./body.ts";
import type { Client, ClientModel } from "./client.ts";
import { drawModel, type Frame } from "./draw.ts";
import { buildHead, type HeadTables } from "./head.ts";
import type { Look } from "./look.ts";
import type { Emote, Mood } from "./vocab.ts";

/**
 * A seq drawn frame by frame, and played the way the client plays it:
 *
 * - `frames`: the pixels of each frame (frames the seq repeats share one
 *   array);
 * - `delays`: how many client cycles each frame stays on screen;
 * - `loop`: the frame it goes back to after the last, or null when it ends
 *   there.
 */
export type Clip = { frames: Int32Array[]; delays: number[]; loop: number | null };

/**
 * An emote as the world shows it on a standing player
 * (`ClientPlayer.getTempModel2`, the emote as the primary seq, the stance as
 * the secondary): every frame at the figure's camera, the hands emptied
 * where the seq says.
 *
 * It plays once. A player's primary seq holds each frame for its delay
 * (`Client.ts:3815`, `primaryAnimCycle -= getDelay`) and, past the last
 * frame, steps back `loops` frames (`:3820`); every emote's `loops` is -1
 * (`scripts/chathead/anims.ts` checks), which steps past the end and stops
 * it, and the player stands again.
 *
 * Each frame is drawn at the figure's camera into a `frame`-sized picture,
 * unless `draw` draws it elsewhere: standing in a scene, at the spot's eye
 * (`lib/scenes/draw.ts`). `draw` is handed the posed body, which is the
 * client's one scratch model, and returns the picture.
 */
export function emoteClip(
  client: Client,
  bodyTables: BodyTables,
  anims: AnimTables,
  look: Look,
  emote: Emote,
  frame: Frame,
  draw: (body: ClientModel) => Int32Array = (body) =>
    drawModel(client, body, frame, FIGURE_CAMERA),
): Clip | null {
  const seq = anims.emotes[emote];
  const drawn = new Map<number, Int32Array>();
  const frames: Int32Array[] = [];
  for (const id of seq.frames) {
    let pixels = drawn.get(id);
    if (!pixels) {
      const pose = { frame: id, hideLeft: seq.hideLeft, hideRight: seq.hideRight };
      const body = buildBody(client, bodyTables, look, pose);
      if (!body) return null;
      pixels = draw(body);
      drawn.set(id, pixels);
    }
    frames.push(pixels);
  }
  return { frames, delays: [...seq.delays], loop: null };
}

/**
 * The line count a mood's seq is picked by, 1 to 4 (`human.mesanim`'s len1
 * to len4): a page's lines, held to that range.
 */
export function lineCount(lines: number): number {
  return Math.min(Math.max(Math.round(lines) || 1, 1), 4);
}

/**
 * A chathead talking in a mood, as a dialogue draws it: the mood's seq for
 * the page's line count (`human.mesanim`'s len1..len4), every frame through
 * `IfType.getTempModel`'s copy, animate and light, at the dialogue camera.
 *
 * It loops as the dialogue's model component does (`Client.ts:10585`,
 * `animCycle -= getDelay + 1`: each frame stays one cycle longer than its
 * delay; `:10589`, past the last frame, back `loops` frames, or to the first
 * if that lands outside the seq): the head talks once, then keeps up the
 * seq's last few frames for as long as it is shown.
 */
export function moodClip(
  client: Client,
  headTables: HeadTables,
  anims: AnimTables,
  look: Look,
  mood: Mood,
  lines: number,
): Clip | null {
  const seq = anims.moods[mood][lineCount(lines) - 1];
  const head = buildHead(client, headTables, look);
  if (!head) return null;

  const drawn = new Map<string, Int32Array>();
  const frames = seq.frames.map((id, i) => {
    const second = seq.iframes[i] ?? -1;
    const key = `${id},${second}`;
    let pixels = drawn.get(key);
    if (!pixels) {
      pixels = drawModel(client, animatedHead(client, head, id, second), headTables.frame);
      drawn.set(key, pixels);
    }
    return pixels;
  });
  const back = seq.frames.length - seq.loops;
  return {
    frames,
    delays: seq.delays.map((delay) => delay + 1),
    loop: back >= 0 && back < seq.frames.length ? back : 0,
  };
}

/**
 * `IfType.getTempModel` (Client-TS `config/IfType.ts:364`–`393`) for a model
 * component holding the player's head (`if_setplayerhead`), as `Client.ts`
 * draws one with a seq (`:10222`: the seq's `frames` and `iframes` at the
 * component's frame):
 *
 * - `:380` copy the head, colours shared and points not, the alpha shared
 *   only if neither frame moves it (`AnimFrame.animateTransparencies`);
 * - `:382` prepare the copy when either frame is set;
 * - `:386`, `:390` pose it with the first frame, then the second;
 * - `:393` light it, as `light()` lights a still one.
 *
 * The head itself is never moved, as the client's cached one is not.
 */
function animatedHead(
  client: Client,
  head: ClientModel,
  first: number,
  second: number,
): ClientModel {
  const shareAlpha =
    client.AnimFrame.animateTransparencies(first) &&
    client.AnimFrame.animateTransparencies(second);
  const tmp = client.Model.copyForAnim(head, true, shareAlpha, false);
  if (first !== -1 || second !== -1) tmp.prepareAnim();
  if (first !== -1) tmp.animate(first);
  if (second !== -1) tmp.animate(second);
  tmp.calculateNormals(64, 768, -50, -10, -50, true);
  return tmp;
}

/**
 * The frame a clip shows `elapsed` client cycles after it starts, or null
 * once a clip that does not loop has ended.
 *
 * A clip that loops restarts at its `loop` frame each time through; one
 * that plays once ends after its last frame.
 */
export function frameAt(
  clip: Pick<Clip, "delays" | "loop">,
  elapsed: number,
): number | null {
  const { delays, loop } = clip;
  let at = Math.max(0, Math.floor(elapsed));
  const total = delays.reduce((sum, delay) => sum + delay, 0);
  if (at >= total) {
    if (loop === null) return null;
    const start = delays.slice(0, loop).reduce((sum, delay) => sum + delay, 0);
    at = start + ((at - total) % (total - start));
  }
  for (let i = 0; i < delays.length; i++) {
    if (at < delays[i]) return i;
    at -= delays[i];
  }
  return null;
}

/**
 * The frame a still shows of a seq of `frames` frames: the middle one - an
 * emote at its height, a mood mid-word - its most telling frame. The Words
 * tab's pickers draw thirteen emotes and fourteen moods at once, so each is
 * one frame, not a clip.
 */
export function stillIndex(frames: number): number {
  return frames > 0 ? Math.floor(frames / 2) : 0;
}

/** The pose an emote's still stands in: its middle frame, the hands emptied as the seq says. */
export function stillPose(seq: SeqClip): Pose {
  return { frame: seq.frames[stillIndex(seq.frames.length)], hideLeft: seq.hideLeft, hideRight: seq.hideRight };
}

/** The two frames a mood's still poses the head with: the middle one, and its second (-1 for none). */
export function stillMoodFrames(seq: SeqClip): { first: number; second: number } {
  const i = stillIndex(seq.frames.length);
  return { first: seq.frames[i], second: seq.iframes[i] ?? -1 };
}

/**
 * One still of a look acting out an emote (`stillPose`), drawn by `draw`
 * as `emoteClip` draws each of its frames. No emote is the look standing.
 */
export function emoteStill(
  client: Client,
  bodyTables: BodyTables,
  anims: AnimTables,
  look: Look,
  emote: Emote | null,
  draw: (body: ClientModel) => Int32Array,
): Int32Array | null {
  const body = buildBody(client, bodyTables, look, emote ? stillPose(anims.emotes[emote]) : undefined);
  return body ? draw(body) : null;
}

/**
 * One still of a chathead in a mood: the middle frame of the mood's
 * one-line seq (len1, the one a page of up to one line plays), posed and
 * lit as `moodClip` poses each frame, at the dialogue camera.
 */
export function moodStill(
  client: Client,
  headTables: HeadTables,
  anims: AnimTables,
  look: Look,
  mood: Mood,
): Int32Array | null {
  const head = buildHead(client, headTables, look);
  if (!head) return null;
  const { first, second } = stillMoodFrames(anims.moods[mood][0]);
  return drawModel(client, animatedHead(client, head, first, second), headTables.frame);
}
