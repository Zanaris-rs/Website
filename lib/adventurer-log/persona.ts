import type { Statement } from "@/lib/account/register";
import { FACINGS } from "@/lib/chathead/facing";
import { type Emote, isEmote, isMood, type Mood } from "@/lib/chathead/vocab";

/**
 * An adventurer's persona (migrations 16 and 17): the words and picks the
 * Character tabs save and the card and dialogue draw. The call into
 * accounts.adventure_persona and a strict parse of what it answers, the same
 * discipline as queries.ts.
 *
 * Migration 17 dropped the free-text clan (membership is real now, read
 * through `clan_of`) and the playstyle, and added `facing`: which of the
 * sixteen ways (`lib/chathead/facing.ts`) the figure faces when someone
 * opens the log.
 */

export const GODS = ["saradomin", "zamorak", "guthix"] as const;
export type God = (typeof GODS)[number];
export const GOD_NAMES: Record<God, string> = { saradomin: "Saradomin", zamorak: "Zamorak", guthix: "Guthix" };

export const PERSONA_LIMITS = {
  title: 24, examine: 80, hangout: 40, goals: 3, goal: 40, pages: 5, lines: 4, line: 60,
} as const;

export type DialoguePage = { mood: Mood; emote: Emote | null; lines: string[] };

export type Persona = {
  colour: number;
  effect: number;
  title: string;
  examine: string;
  hangout: string;
  goals: string[];
  god: God | null;
  homeTown: string | null;
  scene: string | null;
  /** 0-15; 0 is the angle every figure had before figures could turn. */
  facing: number;
  signatureEmote: Emote | null;
  dialogue: DialoguePage[];
};

export const EMPTY_PERSONA: Persona = {
  colour: 0, effect: 0, title: "", examine: "", hangout: "", goals: [],
  god: null, homeTown: null, scene: null, facing: 0, signatureEmote: null, dialogue: [],
};

export function personaStatement(name: string): Statement {
  return { text: "select * from accounts.adventure_persona($1)", values: [name] };
}

const fail = (what: string, value: unknown): never => {
  throw new Error(`adventure_persona ${what}: ${JSON.stringify(value)}`);
};
const text = (value: unknown, what: string): string => (typeof value === "string" ? value : fail(what, value));
const keyOrNull = (value: unknown, what: string): string | null =>
  value === null ? null : typeof value === "string" && /^[a-z_]{1,24}$/.test(value) ? value : fail(what, value);
const intIn = (value: unknown, max: number, what: string): number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= max ? value : fail(what, value);

function pageOf(value: unknown): DialoguePage {
  if (typeof value !== "object" || value === null) return fail("dialogue page", value);
  const page = value as Record<string, unknown>;
  if (!isMood(page.mood)) return fail("dialogue mood", page.mood);
  if (page.emote !== null && !isEmote(page.emote)) return fail("dialogue emote", page.emote);
  if (!Array.isArray(page.lines) || page.lines.length < 1 || page.lines.length > 4 || !page.lines.every((l) => typeof l === "string")) {
    return fail("dialogue lines", page.lines);
  }
  return { mood: page.mood, emote: page.emote as Emote | null, lines: page.lines as string[] };
}

export function parsePersona(rows: readonly unknown[]): Persona {
  if (rows.length === 0) return EMPTY_PERSONA;
  if (rows.length > 1) throw new Error(`adventure_persona returned ${rows.length} rows; at most one`);
  const row = rows[0] as Record<string, unknown>;
  if (!Array.isArray(row.goals) || !row.goals.every((g) => typeof g === "string")) fail("goals", row.goals);
  if (!Array.isArray(row.dialogue)) fail("dialogue", row.dialogue);
  if (row.god !== null && !(GODS as readonly unknown[]).includes(row.god)) fail("god", row.god);
  if (row.signature_emote !== null && !isEmote(row.signature_emote)) fail("signature_emote", row.signature_emote);
  return {
    colour: intIn(row.headline_colour, 11, "headline_colour"),
    effect: intIn(row.headline_effect, 2, "headline_effect"),
    title: text(row.title, "title"),
    examine: text(row.examine, "examine"),
    hangout: text(row.hangout, "hangout"),
    goals: row.goals as string[],
    god: row.god as God | null,
    homeTown: keyOrNull(row.home_town, "home_town"),
    scene: keyOrNull(row.scene, "scene"),
    facing: intIn(row.facing, FACINGS - 1, "facing"),
    signatureEmote: row.signature_emote as Emote | null,
    dialogue: (row.dialogue as unknown[]).map(pageOf),
  };
}
