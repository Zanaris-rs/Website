import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { AnimTables, SeqClip } from "../../lib/chathead/anims.ts";
import { encodeAnims } from "../../lib/chathead/anims-file.ts";
import { FIGURE_CAMERA } from "../../lib/chathead/body.ts";
import type { Client, ClientModel } from "../../lib/chathead/client.ts";
import { BACKGROUND, drawModel, type Frame } from "../../lib/chathead/draw.ts";
import type { Look } from "../../lib/chathead/look.ts";
import { type Emote, EMOTES, EMOTE_SEQS, type Mood, MOODS } from "../../lib/chathead/vocab.ts";
import type FileCache from "../game-icons/cache.ts";
import type { StandingPlayer } from "./bodies.ts";
import { cutAnim, framesIn } from "./stances.ts";

/**
 * The twelve emotes a figure plays and the fourteen moods a chathead talks
 * in, and the pictures that prove the site plays them right, written by
 * `build.ts`:
 *
 *   public/game/chathead/anims.bin   the anim files their frames are in, cut down to them
 *   lib/chathead/anims.json          each seq's frames, second frames, delays, loops, hands
 *   lib/chathead/anim-golden.json    reference frames for the golden test
 *
 * The reference frames are drawn by the client's own classes — an emote by
 * `ClientPlayer.getTempModel2` with the emote as its primary seq, a mood by
 * `IfType.getTempModel` for a component holding the player's head — with
 * every anim file in the cache loaded whole, so the golden test checks the
 * site's `animate.ts`, the tables and the cut `anims.bin` together.
 */

const ANIM_ARCHIVE = 2;

export type Seq = {
  frames: Int16Array | null;
  iframes: Int16Array | null;
  loops: number;
  replaceheldleft: number;
  replaceheldright: number;
  getDelay(frame: number): number;
};

/** A model component (`IfType`), as far as a mood's reference uses one. */
type IfTypeClass = {
  modelCache: { clear(): void };
  new (): {
    model1Type: number;
    model1Id: number;
    getTempModel(
      primaryFrame: number,
      secondaryFrame: number,
      active: boolean,
      localPlayer: object | null,
    ): ClientModel | null;
  };
};

export type AnimGoldenInputs = {
  /** The client's source classes, which draw the reference frames. */
  source: Client;
  IfType: IfTypeClass;
  /** The client's own player standing in a look (`bodies.ts`). */
  standing(look: Look): StandingPlayer;
  /** The client's own player in a look, ready to have its head drawn (`build.ts`). */
  headPlayer(look: Look): object;
  figureFrame: Frame;
  headFrame: Frame;
};

type Golden = { name: string; look: Look };
type EmoteEntry = Golden & { emote: Emote; frame: number; hash: string | null };
type MoodEntry = Golden & { mood: Mood; lines: number; frame: number; hash: string | null };

export function exportAnims(input: {
  contentDir: string;
  outDir: string;
  cache: FileCache;
  SeqType: { list: Seq[] };
  AnimFrame: { init(total: number): void; unpack(data: Uint8Array): void };
  /** bodies.ts's own frame total (R5): the two exports must agree, since
   * `load.ts` inits AnimFrame's table once for both bodies.bin and
   * anims.bin. */
  bodiesFrames: number;
  golden: AnimGoldenInputs;
}) {
  const ids = new Map<string, number>();
  for (const line of readFileSync(path.join(input.contentDir, "pack/seq.pack"), "utf8").split("\n")) {
    const match = /^(\d+)=(\w+)$/.exec(line.trim());
    if (match) ids.set(match[2], Number(match[1]));
  }
  const seqId = (name: string) => {
    const id = ids.get(name);
    if (id === undefined) throw new Error(`seq ${name} is not in seq.pack`);
    return id;
  };

  const mesanim = readFileSync(path.join(input.contentDir, "scripts/general/configs/human.mesanim"), "utf8");
  const moodSeqs = new Map<string, string[]>();
  let section = "";
  for (const line of mesanim.split("\n")) {
    const head = /^\[(\w+)\]/.exec(line.trim());
    if (head) { section = head[1]; moodSeqs.set(section, []); continue; }
    const len = /^len([1-4])=(\w+)$/.exec(line.trim());
    if (len && section) moodSeqs.get(section)![Number(len[1]) - 1] = len[2];
  }

  // Every frame any wanted seq uses — its frames, and the second frames a
  // chathead's mouth moves with (`iframes`) — found in its anim file and
  // unpacked, so getDelay can read a frame's own delay where the seq gives
  // none.
  const wanted = [
    ...EMOTES.map((emote) => seqId(EMOTE_SEQS[emote])),
    ...MOODS.flatMap((mood) => {
      const names = moodSeqs.get(mood);
      if (!names || names.length !== 4) throw new Error(`human.mesanim has no len1..len4 for ${mood}`);
      return names.map(seqId);
    }),
  ];
  const needed = new Set<number>();
  for (const id of wanted) {
    const seq = input.SeqType.list[id];
    for (const frame of [...(seq.frames ?? []), ...(seq.iframes ?? [])]) {
      if (frame !== -1) needed.add(frame);
    }
  }

  const where = new Map<number, number>();
  let total = 0;
  for (let file = 0; file < input.cache.count(ANIM_ARCHIVE); file++) {
    const data = input.cache.readGzip(ANIM_ARCHIVE, file);
    if (!data) continue;
    for (const id of framesIn(data)) {
      where.set(id, file);
      total = Math.max(total, id + 1);
    }
  }
  // R5: exportAnims and exportBodies must agree on the cache's frame total,
  // since the browser inits AnimFrame's table once and shares it between
  // bodies.bin and anims.bin. A mismatch would mean the Client-TS clone
  // moved between the two exports, or one of them missed frames.
  if (total !== input.bodiesFrames) {
    throw new Error(
      `anims: frame total ${total} does not match bodies.bin's ${input.bodiesFrames}; the cache changed between exports`,
    );
  }
  const byFile = new Map<number, Set<number>>();
  for (const frame of needed) {
    const file = where.get(frame);
    if (file === undefined) throw new Error(`frame ${frame} is in no anim file`);
    byFile.set(file, (byFile.get(file) ?? new Set()).add(frame));
  }
  input.AnimFrame.init(total);
  const anims: Uint8Array[] = [];
  for (const [file, keep] of [...byFile].sort(([a], [b]) => a - b)) {
    const data = input.cache.readGzip(ANIM_ARCHIVE, file)!;
    input.AnimFrame.unpack(data);
    anims.push(cutAnim(data, keep));
  }

  const clip = (id: number): SeqClip => {
    const seq = input.SeqType.list[id];
    const frames = [...(seq.frames ?? [])];
    for (const [side, value] of [["left", seq.replaceheldleft], ["right", seq.replaceheldright]] as const) {
      if (value !== -1 && value !== 0) throw new Error(`seq ${id} puts object ${value} in the ${side} hand; only hiding is supported`);
    }
    return {
      frames,
      iframes: frames.map((_, i) => seq.iframes?.[i] ?? -1),
      delays: frames.map((_, i) => seq.getDelay(i)),
      loops: seq.loops,
      hideLeft: seq.replaceheldleft === 0,
      hideRight: seq.replaceheldright === 0,
    };
  };

  const emotes = Object.fromEntries(
    EMOTES.map((emote) => {
      const seq = clip(seqId(EMOTE_SEQS[emote]));
      // `animate.ts` plays an emote once, as the client plays a player's
      // primary seq whose `loops` steps past its end (`Client.ts:3820`).
      if (seq.loops !== -1) throw new Error(`emote ${emote} loops (${seq.loops}); a figure plays it once`);
      return [emote, seq];
    }),
  ) as Record<Emote, SeqClip>;

  const bytes = encodeAnims({ frames: total, anims });
  const body = {
    total,
    emotes,
    moods: Object.fromEntries(MOODS.map((mood) => [mood, moodSeqs.get(mood)!.map((name) => clip(seqId(name)))])),
  };
  const version = createHash("sha256").update(bytes).update(JSON.stringify(body)).digest("hex").slice(0, 12);
  const tables = { version, ...body } as AnimTables;

  writeFileSync(path.join(input.outDir, "public/game/chathead/anims.bin"), bytes);
  writeFileSync(path.join(input.outDir, "lib/chathead/anims.json"), JSON.stringify(tables) + "\n");
  console.log(`anims    ${EMOTES.length} emotes, ${MOODS.length} moods x 4 in ${anims.length} cut anim files, ${bytes.length} bytes -> public/game/chathead/anims.bin?v=${version}`);

  // --- golden references --------------------------------------------------

  const { source, IfType, standing, headPlayer, figureFrame, headFrame } = input.golden;

  // The client's whole table, as a client that loads anim files as they are
  // asked for has it: every file in the cache, whole. A frame the cut
  // anims.bin leaves out is then posed here and not on the site.
  for (let file = 0; file < input.cache.count(ANIM_ARCHIVE); file++) {
    const data = input.cache.readGzip(ANIM_ARCHIVE, file);
    if (data) input.AnimFrame.unpack(data);
  }

  function hash(pixels: Int32Array): string | null {
    if (pixels.every((rgb) => rgb === BACKGROUND)) return null;
    return createHash("sha256").update(new Uint8Array(pixels.buffer)).digest("hex").slice(0, 16);
  }

  /**
   * The client's own frame of an emote: a player standing still in the
   * look, the emote their primary seq at `index` with no delay left, as
   * `ClientPlayer.getTempModel2` builds it, at the figure's camera.
   */
  function emoteReference(look: Look, emote: Emote, index: number): Int32Array {
    const player = standing(look);
    player.primaryAnim = seqId(EMOTE_SEQS[emote]);
    player.primaryAnimFrame = index;
    player.primaryAnimDelay = 0;
    const body = player.getTempModel2();
    if (!body) throw new Error("the client built no body");
    return drawModel(source, body, figureFrame, FIGURE_CAMERA);
  }

  /**
   * The client's own frame of a mood: a dialogue's model component holding
   * the player's head (`if_setplayerhead`, `model1Type` 3), drawn with the
   * mood's seq at `index` as `Client.ts:10222` draws it — the seq's frame
   * and its `iframes` frame through `IfType.getTempModel` — at the
   * dialogue's camera. The component caches the head by `model1Id`; the
   * cache is emptied so that each look builds its own.
   */
  function moodReference(look: Look, seq: Seq, index: number): Int32Array {
    IfType.modelCache.clear();
    const component = new IfType();
    component.model1Type = 3;
    component.model1Id = 0;
    const model = component.getTempModel(seq.frames![index], seq.iframes![index], false, headPlayer(look));
    if (!model) throw new Error("the client built no head");
    return drawModel(source, model, headFrame);
  }

  const read = (file: string) =>
    JSON.parse(readFileSync(path.join(input.outDir, "lib/chathead", file), "utf8")).looks as Golden[];
  const figureLooks = read("figure-golden.json");
  const headLooks = read("golden.json");

  const emoteGolden: EmoteEntry[] = [];
  const addEmote = ({ name, look }: Golden, emote: Emote, frame: number) =>
    emoteGolden.push({ name, look, emote, frame, hash: hash(emoteReference(look, emote, frame)) });

  // The figure's first three golden looks, and its whole outfits, which
  // hold a weapon and a shield (a two-handed sword hiding one), waving —
  // frame 2, the arm up and the hands empty.
  const named = figureLooks.filter(({ name }) => !/^(kit|colour|obj) /.test(name));
  for (const entry of named) addEmote(entry, "wave", 2);
  // Every frame of every emote once, on one look in full armour with a
  // weapon and a shield: every frame anims.bin carries for a figure.
  const armour = named.find(({ name }) => name === "rune armour male")!;
  for (const emote of EMOTES) {
    const seen = new Set<number>();
    emotes[emote].frames.forEach((id, index) => {
      if (seen.has(id)) return;
      seen.add(id);
      addEmote(armour, emote, index);
    });
  }

  const moodGolden: MoodEntry[] = [];
  const addMood = ({ name, look }: Golden, mood: Mood, lines: number, frame: number) => {
    const seq = input.SeqType.list[seqId(moodSeqs.get(mood)![lines - 1])];
    moodGolden.push({ name, look, mood, lines, frame, hash: hash(moodReference(look, seq, frame)) });
  };

  // The chathead's first three golden looks, happy over two lines, at frame
  // 3: the head turned and the mouth open.
  for (const entry of headLooks.slice(0, 3)) addMood(entry, "happy", 2, 3);
  // Every pair of frames any mood poses a head with, once, on the default
  // man: every frame anims.bin carries for a chathead.
  const man = headLooks[0];
  const pairs = new Set<string>();
  for (const mood of MOODS) {
    body.moods[mood].forEach((seq, len) => {
      seq.frames.forEach((id, index) => {
        const pair = `${id},${seq.iframes[index]}`;
        if (pairs.has(pair)) return;
        pairs.add(pair);
        addMood(man, mood, len + 1, index);
      });
    });
  }

  const line = (entry: object) => JSON.stringify(entry);
  writeFileSync(
    path.join(input.outDir, "lib/chathead/anim-golden.json"),
    `{"version":${JSON.stringify(version)},\n"emotes":[\n${emoteGolden.map(line).join(",\n")}\n],\n` +
      `"moods":[\n${moodGolden.map(line).join(",\n")}\n]}\n`,
  );
  console.log(
    `         ${emoteGolden.length} emote frames and ${moodGolden.length} mood frames, drawn by the client -> lib/chathead/anim-golden.json`,
  );
  return { version, tables };
}
