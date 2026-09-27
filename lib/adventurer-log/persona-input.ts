import type { Statement } from "@/lib/account/register";
import { FACINGS } from "@/lib/chathead/facing";
import { type Emote, isEmote, isMood } from "@/lib/chathead/vocab";
import { sceneOf } from "@/lib/scenes/spots";

import { checkText, HEADLINE_MAX } from "./format";
import { type DialoguePage, type God, GODS, type Persona, PERSONA_LIMITS } from "./persona";
import { isPlace } from "./places";

/**
 * The Character tabs' three saves (migration 17), one database function
 * each, so no tab's Save can overwrite what another tab changed. Each is
 * checked here the way its function will check it, so the owner gets a
 * plain sentence instead of a code. The database still checks everything;
 * this only gets there first. Browser-safe: the tabs run these before they
 * send.
 *
 * - Words (`adventure_persona_save_words`): the headline, its colour and
 *   effect, the signature emote and the dialogue.
 * - Sheet (`adventure_persona_save_sheet`): title, examine, hangout, goals,
 *   god and home town.
 * - Stage (`adventure_persona_save_stage`): the scene and the facing. Picks
 *   only, so a mute never refuses it.
 */

export type WordsInput = {
  headline: string;
  colour: number;
  effect: number;
  signatureEmote: Emote | null;
  dialogue: DialoguePage[];
};
export type SheetInput = {
  title: string;
  examine: string;
  hangout: string;
  goals: string[];
  god: God | null;
  homeTown: string | null;
};
export type StageInput = { scene: string | null; facing: number };

type Check<T> = { ok: true; value: T } | { ok: false; error: string };

const bad = (error: string) => ({ ok: false as const, error });
const oneLine = { emptyOk: true, oneLine: true } as const;

function objectOf(raw: unknown): Record<string, unknown> | null {
  return typeof raw === "object" && raw !== null && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
}

const isIntIn = (value: unknown, max: number): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= max;

function checkDialogue(raw: unknown): Check<DialoguePage[]> {
  if (!Array.isArray(raw)) return bad("The dialogue must be a list of pages.");
  if (raw.length > PERSONA_LIMITS.pages) return bad(`At most ${PERSONA_LIMITS.pages} pages.`);
  const pages: DialoguePage[] = [];
  for (const [index, value] of raw.entries()) {
    const page: Record<string, unknown> = objectOf(value) ?? {};
    const where = `Page ${index + 1}`;
    if (!isMood(page.mood)) return bad(`${where}: pick a mood.`);
    const emote = page.emote ?? null;
    if (emote !== null && !isEmote(emote)) return bad(`${where}: pick an emote from the list.`);
    if (!Array.isArray(page.lines)) return bad(`${where}: write something.`);
    const lines: string[] = [];
    for (const line of page.lines) {
      const checked = checkText(line, `${where}'s line`, PERSONA_LIMITS.line, oneLine);
      if (!checked.ok) return bad(checked.error);
      lines.push(checked.value);
    }
    while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
    if (lines.length === 0) return bad(`${where}: write something, or remove the page.`);
    if (lines.length > PERSONA_LIMITS.lines) return bad(`${where}: at most ${PERSONA_LIMITS.lines} lines.`);
    if (lines.includes("")) return bad(`${where}: no empty lines in the middle.`);
    pages.push({ mood: page.mood, emote: emote as Emote | null, lines });
  }
  return { ok: true, value: pages };
}

export function checkWordsInput(raw: unknown): Check<WordsInput> {
  const input = objectOf(raw);
  if (!input) return bad("Nothing to save.");

  const headline = checkText(input.headline ?? "", "The headline", HEADLINE_MAX, oneLine);
  if (!headline.ok) return bad(headline.error);
  const { colour, effect } = input;
  if (!isIntIn(colour, 11)) return bad("Pick one of the twelve colours.");
  if (!isIntIn(effect, 2)) return bad("Pick None, Wave or Scroll.");
  const signatureEmote = input.signatureEmote ?? null;
  if (signatureEmote !== null && !isEmote(signatureEmote)) return bad("Pick an emote from the list.");
  const dialogue = checkDialogue(input.dialogue);
  if (!dialogue.ok) return dialogue;

  return {
    ok: true,
    value: {
      headline: headline.value,
      colour,
      effect,
      signatureEmote: signatureEmote as Emote | null,
      dialogue: dialogue.value,
    },
  };
}

export function checkSheetInput(raw: unknown): Check<SheetInput> {
  const input = objectOf(raw);
  if (!input) return bad("Nothing to save.");

  const words = { title: "", examine: "", hangout: "" };
  for (const [key, label, max] of [
    ["title", "The title", PERSONA_LIMITS.title],
    ["examine", "The examine text", PERSONA_LIMITS.examine],
    ["hangout", "The hangout", PERSONA_LIMITS.hangout],
  ] as const) {
    const checked = checkText(input[key] ?? "", label, max, oneLine);
    if (!checked.ok) return bad(checked.error);
    words[key] = checked.value;
  }

  if (!Array.isArray(input.goals)) return bad("Goals must be a list.");
  const goals: string[] = [];
  for (const goal of input.goals) {
    const checked = checkText(goal, "A goal", PERSONA_LIMITS.goal, oneLine);
    if (!checked.ok) return bad(checked.error);
    if (checked.value) goals.push(checked.value);
  }
  if (goals.length > PERSONA_LIMITS.goals) return bad(`At most ${PERSONA_LIMITS.goals} goals.`);

  const god = input.god ?? null;
  if (god !== null && !(GODS as readonly unknown[]).includes(god)) return bad("Pick a god from the list.");
  const homeTown = input.homeTown ?? null;
  if (homeTown !== null && !isPlace(homeTown)) return bad("Pick a home town from the list.");

  return { ok: true, value: { ...words, goals, god: god as God | null, homeTown: homeTown as string | null } };
}

export function checkStageInput(raw: unknown): Check<StageInput> {
  const input = objectOf(raw);
  if (!input) return bad("Nothing to save.");

  const scene = input.scene ?? null;
  // A place the build framed a scene at (lib/scenes/spots.json), not just any place.
  if (scene !== null && (typeof scene !== "string" || !sceneOf(scene))) return bad("Pick a scene from the list.");
  // Any of the sixteen. Whether this scene proved that angle clean is the
  // drawing's business (`nearestFacing`), not the save's: the database only
  // checks the range.
  const { facing } = input;
  if (!isIntIn(facing, FACINGS - 1)) return bad("Pick one of the sixteen ways to face.");

  return { ok: true, value: { scene: scene as string | null, facing } };
}

/** The Words tab's draft: the stored persona's words and the log's headline. */
export function wordsOf(persona: Persona, headline: string): WordsInput {
  return {
    headline,
    colour: persona.colour,
    effect: persona.effect,
    signatureEmote: persona.signatureEmote,
    dialogue: persona.dialogue,
  };
}

/**
 * The Sheet tab's draft. A home town the site no longer lists would have
 * every Save refused with "Pick a home town from the list", for a pick the
 * owner cannot see in the select. It starts as none.
 */
export function sheetOf(persona: Persona): SheetInput {
  return {
    title: persona.title,
    examine: persona.examine,
    hangout: persona.hangout,
    goals: persona.goals,
    god: persona.god,
    homeTown: persona.homeTown !== null && isPlace(persona.homeTown) ? persona.homeTown : null,
  };
}

/**
 * Where the figure stands and which way it faces, as the Look tab starts
 * from them. A scene whose backdrop is gone starts as none, for the same
 * reason as `sheetOf`'s home town.
 */
export function stageOf(persona: Persona): StageInput {
  return { scene: sceneOf(persona.scene) ? persona.scene : null, facing: persona.facing };
}

export function wordsSaveStatement(username: string, value: WordsInput): Statement {
  return {
    text: "select accounts.adventure_persona_save_words($1, $2, $3, $4, $5, $6::jsonb) as result",
    values: [username, value.headline, value.colour, value.effect, value.signatureEmote, JSON.stringify(value.dialogue)],
  };
}

export function sheetSaveStatement(username: string, value: SheetInput): Statement {
  return {
    text: "select accounts.adventure_persona_save_sheet($1, $2, $3, $4, $5::jsonb, $6, $7) as result",
    values: [
      username, value.title, value.examine, value.hangout, JSON.stringify(value.goals), value.god, value.homeTown,
    ],
  };
}

export function stageSaveStatement(username: string, value: StageInput): Statement {
  return {
    text: "select accounts.adventure_persona_save_stage($1, $2, $3) as result",
    values: [username, value.scene, value.facing],
  };
}
