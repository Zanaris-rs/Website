/**
 * The game's emotes and chathead moods an adventurer can use. The database
 * holds the same two lists (migration 16's adventure_emotes and
 * adventure_moods); vocab.test.ts pins both.
 */
export const EMOTES = ["yes", "no", "think", "bow", "angry", "cry", "laugh", "cheer", "wave", "beckon", "clap", "dance"] as const;
export type Emote = (typeof EMOTES)[number];
export const EMOTE_NAMES: Record<Emote, string> = {
  yes: "Yes", no: "No", think: "Think", bow: "Bow", angry: "Angry", cry: "Cry",
  laugh: "Laugh", cheer: "Cheer", wave: "Wave", beckon: "Beckon", clap: "Clap", dance: "Dance",
};
/** The seq each emote plays: content's `seq.pack` names (855-866). */
export const EMOTE_SEQS: Record<Emote, string> = Object.fromEntries(
  EMOTES.map((emote) => [emote, `emote_${emote}`]),
) as Record<Emote, string>;

/** content's human.mesanim sections, less 'short' and 'idle'. */
export const MOODS = ["neutral", "happy", "sad", "angry", "verymad", "laugh", "evillaugh", "shock", "confused", "bored", "shifty", "scared", "drunk", "quiz"] as const;
export type Mood = (typeof MOODS)[number];
export const MOOD_NAMES: Record<Mood, string> = {
  neutral: "Neutral", happy: "Happy", sad: "Sad", angry: "Angry", verymad: "Very mad",
  laugh: "Laughing", evillaugh: "Evil laugh", shock: "Shocked", confused: "Confused",
  bored: "Bored", shifty: "Shifty", scared: "Scared", drunk: "Drunk", quiz: "Quizzical",
};

export const isEmote = (value: unknown): value is Emote => (EMOTES as readonly unknown[]).includes(value);
export const isMood = (value: unknown): value is Mood => (MOODS as readonly unknown[]).includes(value);
