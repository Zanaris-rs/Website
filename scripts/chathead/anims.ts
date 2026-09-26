import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { AnimTables, SeqClip } from "../../lib/chathead/anims.ts";
import { encodeAnims } from "../../lib/chathead/anims-file.ts";
import { EMOTES, EMOTE_SEQS, MOODS } from "../../lib/chathead/vocab.ts";
import type FileCache from "../game-icons/cache.ts";
import { cutAnim, framesIn } from "./stances.ts";

const ANIM_ARCHIVE = 2;

export type Seq = {
  frames: Int16Array | null;
  replaceheldleft: number;
  replaceheldright: number;
  getDelay(frame: number): number;
};

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

  // Every frame any wanted seq uses, found in its anim file and unpacked,
  // so getDelay can read a frame's own delay where the seq gives none.
  const wanted = [
    ...EMOTES.map((emote) => seqId(EMOTE_SEQS[emote])),
    ...MOODS.flatMap((mood) => {
      const names = moodSeqs.get(mood);
      if (!names || names.length !== 4) throw new Error(`human.mesanim has no len1..len4 for ${mood}`);
      return names.map(seqId);
    }),
  ];
  const needed = new Set<number>();
  for (const id of wanted) for (const frame of input.SeqType.list[id].frames ?? []) needed.add(frame);

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
      delays: frames.map((_, i) => seq.getDelay(i)),
      hideLeft: seq.replaceheldleft === 0,
      hideRight: seq.replaceheldright === 0,
    };
  };

  const bytes = encodeAnims({ frames: total, anims });
  const body = {
    total,
    emotes: Object.fromEntries(EMOTES.map((emote) => [emote, clip(seqId(EMOTE_SEQS[emote]))])),
    moods: Object.fromEntries(MOODS.map((mood) => [mood, moodSeqs.get(mood)!.map((name) => clip(seqId(name)))])),
  };
  const version = createHash("sha256").update(bytes).update(JSON.stringify(body)).digest("hex").slice(0, 12);
  const tables = { version, ...body } as AnimTables;

  writeFileSync(path.join(input.outDir, "public/game/chathead/anims.bin"), bytes);
  writeFileSync(path.join(input.outDir, "lib/chathead/anims.json"), JSON.stringify(tables) + "\n");
  console.log(`anims    ${EMOTES.length} emotes, ${MOODS.length} moods x 4 in ${anims.length} cut anim files, ${bytes.length} bytes -> public/game/chathead/anims.bin?v=${version}`);
  return { version, tables };
}
