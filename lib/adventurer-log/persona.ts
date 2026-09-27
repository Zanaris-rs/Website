import type { Statement } from "@/lib/account/register";
import { type Emote, isEmote, isMood, type Mood } from "@/lib/chathead/vocab";

/**
 * An adventurer's persona (migration 16): the words and picks the Character
 * tab saves and the card and dialogue draw. The call into
 * accounts.adventure_persona and a strict parse of what it answers, the same
 * discipline as queries.ts.
 */

export const GODS = ["saradomin", "zamorak", "guthix"] as const;
export type God = (typeof GODS)[number];
export const GOD_NAMES: Record<God, string> = { saradomin: "Saradomin", zamorak: "Zamorak", guthix: "Guthix" };

export const PLAYSTYLES = ["main", "pure", "tank", "skiller", "merchant", "quester", "pker", "clue_hunter"] as const;
export type Playstyle = (typeof PLAYSTYLES)[number];
export const PLAYSTYLE_NAMES: Record<Playstyle, string> = {
  main: "Main", pure: "Pure", tank: "Tank", skiller: "Skiller", merchant: "Merchant",
  quester: "Quester", pker: "PKer", clue_hunter: "Clue hunter",
};

export const PERSONA_LIMITS = {
  title: 24, examine: 80, hangout: 40, clan: 24, goals: 3, goal: 40, pages: 5, lines: 4, line: 60,
} as const;

export type DialoguePage = { mood: Mood; emote: Emote | null; lines: string[] };

export type Persona = {
  colour: number;
  effect: number;
  title: string;
  examine: string;
  hangout: string;
  clan: string;
  goals: string[];
  god: God | null;
  homeTown: string | null;
  playstyle: string | null;
  scene: string | null;
  signatureEmote: Emote | null;
  dialogue: DialoguePage[];
};

export const EMPTY_PERSONA: Persona = {
  colour: 0, effect: 0, title: "", examine: "", hangout: "", clan: "", goals: [],
  god: null, homeTown: null, playstyle: null, scene: null, signatureEmote: null, dialogue: [],
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
    clan: text(row.clan, "clan"),
    goals: row.goals as string[],
    god: row.god as God | null,
    homeTown: keyOrNull(row.home_town, "home_town"),
    playstyle: keyOrNull(row.playstyle, "playstyle"),
    scene: keyOrNull(row.scene, "scene"),
    signatureEmote: row.signature_emote as Emote | null,
    dialogue: (row.dialogue as unknown[]).map(pageOf),
  };
}
