import type { Emote, Mood } from "./vocab";

/** One seq, as the site plays it: frame ids, each frame's delay in client cycles, and whether it empties the hands. */
export type SeqClip = { frames: number[]; delays: number[]; hideLeft: boolean; hideRight: boolean };

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
