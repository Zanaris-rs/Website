import { CHAT_COLOUR_NAMES } from "@/lib/game-chat/effects";
import { parseChatPrefix } from "@/lib/game-chat/prefix";

import { type Persona, PERSONA_LIMITS } from "./persona";
import type { PersonaInput } from "./persona-input";

/**
 * The Character tab's draft, step by step: what typing, reordering and
 * saving do to it, kept out of the editor component so each can be tested.
 * Browser-safe: nothing here reaches the server.
 */

/**
 * Typing into the headline. A prefix typed the in-game way (`glow1:wave:hi`)
 * moves into the colour and effect pickers, leaving the text; only what the
 * prefix names changes, so `wave:` keeps the colour already picked.
 */
export function typeHeadline(draft: PersonaInput, value: string): PersonaInput {
  const found = parseChatPrefix(value);
  if (found.text === value) return { ...draft, headline: value };
  const prefix = value.slice(0, value.length - found.text.length);
  const namesColour = CHAT_COLOUR_NAMES.some((name) => prefix.startsWith(`${name}:`));
  const namesEffect = prefix.endsWith("wave:") || prefix.endsWith("scroll:");
  return {
    ...draft,
    headline: found.text,
    colour: namesColour ? found.colour : draft.colour,
    effect: namesEffect ? found.effect : draft.effect,
  };
}

/** A page's textarea as dialogue lines: one per typed line, at most four. */
export function pageLines(value: string): string[] {
  return value.replace(/\r\n/g, "\n").split("\n").slice(0, PERSONA_LIMITS.lines);
}

/** The lines (by index) longer than a line may be once trimmed, as the save trims them. */
export function longLines(lines: readonly string[]): number[] {
  return lines.flatMap((line, index) =>
    line.replace(/^[ \t]+|[ \t]+$/g, "").length > PERSONA_LIMITS.line ? [index] : [],
  );
}

/** `list` with the item at `from` moved to `to`; unchanged past either end. */
export function moved<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  if (to < 0 || to >= list.length || from === to) return next;
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/** The three goal boxes with box `index` set; blank boxes at the end are dropped. */
export function goalsWith(goals: readonly string[], index: number, value: string): string[] {
  const next = Array.from({ length: PERSONA_LIMITS.goals }, (_, i) => (i === index ? value : goals[i] ?? ""));
  while (next.length > 0 && next[next.length - 1] === "") next.pop();
  return next;
}

/** The draft as the card draws it: blank goals are not saved, so not shown. */
export function previewPersona(draft: PersonaInput): Persona {
  return { ...draft, goals: draft.goals.filter((goal) => goal.trim() !== "") };
}

type Field = keyof PersonaInput;

/**
 * Which of the tab's fields each of migration 16's refusals is about, to
 * highlight them. `bad_key` is a home town, playstyle or scene key; the
 * database does not say which.
 */
export const BAD_FIELDS: Readonly<Record<string, readonly Field[]>> = {
  bad_headline: ["headline"],
  bad_title: ["title"],
  bad_examine: ["examine"],
  bad_hangout: ["hangout"],
  bad_clan: ["clan"],
  bad_goals: ["goals"],
  bad_god: ["god"],
  bad_key: ["homeTown", "playstyle", "scene"],
  bad_emote: ["signatureEmote", "dialogue"],
  bad_dialogue: ["dialogue"],
};

/** The save's refusals as sentences, ahead of the log's shared ones (`send`). */
export const SAVE_MESSAGES: Readonly<Record<string, string>> = {
  muted: "You're muted, so you can change picks but not words.",
  ...Object.fromEntries(
    Object.keys(BAD_FIELDS).map((code) => [code, "Something didn't save; check the highlighted field."]),
  ),
};
