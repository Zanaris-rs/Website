import type { Statement } from "@/lib/account/register";
import { type Emote, isEmote, isMood } from "@/lib/chathead/vocab";
import { sceneOf } from "@/lib/scenes/spots";

import { checkText, HEADLINE_MAX } from "./format";
import { type DialoguePage, type God, GODS, type Persona, PERSONA_LIMITS, PLAYSTYLES } from "./persona";
import { isPlace } from "./places";

/**
 * The Character tab's save, checked the way migration 16 will check it, so
 * the owner gets a plain sentence instead of a code. The database still
 * checks everything; this only gets there first.
 */
export type PersonaInput = Persona & { headline: string };
type Check = { ok: true; value: PersonaInput } | { ok: false; error: string };

const bad = (error: string): Check => ({ ok: false, error });
const oneLine = { emptyOk: true, oneLine: true } as const;

export function checkPersonaInput(raw: Record<string, unknown> | null): Check {
  if (!raw) return bad("Nothing to save.");

  const words: Record<string, string> = {};
  for (const [key, label, max] of [
    ["headline", "The headline", HEADLINE_MAX],
    ["title", "The title", PERSONA_LIMITS.title],
    ["examine", "The examine text", PERSONA_LIMITS.examine],
    ["hangout", "The hangout", PERSONA_LIMITS.hangout],
    ["clan", "The clan", PERSONA_LIMITS.clan],
  ] as const) {
    const checked = checkText(raw[key] ?? "", label, max, oneLine);
    if (!checked.ok) return bad(checked.error);
    words[key] = checked.value;
  }

  const { colour, effect } = raw;
  if (typeof colour !== "number" || !Number.isInteger(colour) || colour < 0 || colour > 11) return bad("Pick one of the twelve colours.");
  if (typeof effect !== "number" || !Number.isInteger(effect) || effect < 0 || effect > 2) return bad("Pick None, Wave or Scroll.");

  if (!Array.isArray(raw.goals)) return bad("Goals must be a list.");
  const goals: string[] = [];
  for (const goal of raw.goals) {
    const checked = checkText(goal, "A goal", PERSONA_LIMITS.goal, oneLine);
    if (!checked.ok) return bad(checked.error);
    if (checked.value) goals.push(checked.value);
  }
  if (goals.length > PERSONA_LIMITS.goals) return bad(`At most ${PERSONA_LIMITS.goals} goals.`);

  const god = raw.god ?? null;
  if (god !== null && !(GODS as readonly unknown[]).includes(god)) return bad("Pick a god from the list.");
  const homeTown = raw.homeTown ?? null;
  if (homeTown !== null && !isPlace(homeTown)) return bad("Pick a home town from the list.");
  const playstyle = raw.playstyle ?? null;
  if (playstyle !== null && !(PLAYSTYLES as readonly unknown[]).includes(playstyle)) return bad("Pick a playstyle from the list.");
  const scene = raw.scene ?? null;
  // A place the build framed a scene at (lib/scenes/spots.json), not just any place.
  if (scene !== null && (typeof scene !== "string" || !sceneOf(scene))) return bad("Pick a scene from the list.");
  const signatureEmote = raw.signatureEmote ?? null;
  if (signatureEmote !== null && !isEmote(signatureEmote)) return bad("Pick an emote from the list.");

  if (!Array.isArray(raw.dialogue)) return bad("The dialogue must be a list of pages.");
  if (raw.dialogue.length > PERSONA_LIMITS.pages) return bad(`At most ${PERSONA_LIMITS.pages} pages.`);
  const dialogue: DialoguePage[] = [];
  for (const [index, value] of raw.dialogue.entries()) {
    const page = (value ?? {}) as Record<string, unknown>;
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
    dialogue.push({ mood: page.mood, emote: emote as Emote | null, lines });
  }

  return {
    ok: true,
    value: {
      headline: words.headline, colour, effect, title: words.title, examine: words.examine,
      hangout: words.hangout, clan: words.clan, goals, god: god as God | null, homeTown: homeTown as string | null,
      playstyle: playstyle as string | null, scene: scene as string | null,
      signatureEmote: signatureEmote as Emote | null, dialogue,
    },
  };
}

/**
 * The stored persona as the editor starts from it. A home town, playstyle or
 * scene the site no longer lists (a place dropped since it was saved, or a
 * scene whose backdrop is) would have every Save refused with "Pick ... from
 * the list", for a pick the owner cannot see in the editor - and, without an
 * outfit, cannot clear. It starts as none.
 */
export function editablePersona(stored: PersonaInput): PersonaInput {
  const listed = (key: string | null, known: (key: string) => boolean) => (key !== null && known(key) ? key : null);
  return {
    ...stored,
    homeTown: listed(stored.homeTown, isPlace),
    playstyle: listed(stored.playstyle, (key) => (PLAYSTYLES as readonly string[]).includes(key)),
    scene: listed(stored.scene, (key) => sceneOf(key) !== null),
  };
}

export function personaSaveStatement(username: string, input: PersonaInput): Statement {
  return {
    text:
      "select accounts.adventure_persona_save($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12, $13, $14, $15::jsonb) as result",
    values: [
      username, input.headline, input.colour, input.effect, input.title, input.examine, input.hangout,
      input.clan, JSON.stringify(input.goals), input.god, input.homeTown, input.playstyle, input.scene,
      input.signatureEmote, JSON.stringify(input.dialogue),
    ],
  };
}
