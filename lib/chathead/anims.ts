import type { Emote, Mood } from "./vocab";

/**
 * One seq, as the site plays it (Client-TS `config/SeqType.ts`):
 *
 * - `frames`: the frame ids, in order;
 * - `iframes`: the second frame a model component poses with each one
 *   (`SeqType.iframes`, -1 for none). A chathead mood moves the head with
 *   `frames` and the mouth with `iframes` (`IfType.getTempModel`); a player
 *   in the world never reads them (`ClientPlayer.getTempModel2`);
 * - `delays`: each frame's delay in client cycles (`SeqType.getDelay`);
 * - `loops`: how many frames it steps back after its last (`SeqType.loops`;
 *   -1, the default, steps past the start, which ends it);
 * - `hideLeft`/`hideRight`: whether it empties the hands
 *   (`replaceheldleft`/`replaceheldright` 0).
 */
export type SeqClip = {
  frames: number[];
  iframes: number[];
  delays: number[];
  loops: number;
  hideLeft: boolean;
  hideRight: boolean;
};

/** lib/chathead/anims.json, written by scripts/chathead/anims.ts. */
export type AnimTables = {
  /** Changes whenever anims.bin or these tables do. */
  version: string;
  /** The cache's frame total, for AnimFrame.init. */
  total: number;
  emotes: Record<Emote, SeqClip>;
  /** By line count: [len1, len2, len3, len4], as human.mesanim picks. */
  moods: Record<Mood, SeqClip[]>;
};
