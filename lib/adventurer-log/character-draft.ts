import { CHAT_COLOUR_NAMES } from "@/lib/game-chat/effects";
import { parseChatPrefix } from "@/lib/game-chat/prefix";

import { type Persona, PERSONA_LIMITS } from "./persona";
import type { Check, SheetInput, StageInput, WordsInput } from "./persona-input";

/**
 * The Character tabs' drafts, step by step: what typing, reordering and
 * saving do to them, kept out of the components so each can be tested.
 * Browser-safe: nothing here reaches the server.
 */

/**
 * Typing into the headline. A prefix typed the in-game way (`glow1:wave:hi`)
 * moves into the colour and effect pickers, leaving the text. Only what the
 * prefix names changes, so `wave:` keeps the colour already picked.
 */
export function typeHeadline<T extends { headline: string; colour: number; effect: number }>(draft: T, value: string): T {
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

/** A persona with a draft in it, as the card draws it: blank goals are not saved, so not shown. */
export function previewPersona(persona: Persona): Persona {
  return { ...persona, goals: persona.goals.filter((goal) => goal.trim() !== "") };
}

/** A field of any of the three tabs' drafts. */
export type DraftField = keyof WordsInput | keyof SheetInput | keyof StageInput;

/**
 * Which fields each of migration 17's refusals is about, so they can be
 * highlighted. `bad_key` is a home town or a scene key; the database does
 * not say which. Each tab marks only the fields it has.
 */
export const BAD_FIELDS: Readonly<Record<string, readonly DraftField[]>> = {
  bad_headline: ["headline"],
  bad_colour: ["colour"],
  bad_effect: ["effect"],
  bad_emote: ["signatureEmote", "dialogue"],
  bad_dialogue: ["dialogue"],
  bad_title: ["title"],
  bad_examine: ["examine"],
  bad_hangout: ["hangout"],
  bad_goals: ["goals"],
  bad_god: ["god"],
  bad_key: ["homeTown", "scene"],
  bad_facing: ["facing"],
};

/** The saves' refusals as sentences, ahead of the log's shared ones (`send`). */
export const SAVE_MESSAGES: Readonly<Record<string, string>> = {
  muted: "You're muted, so you can change picks but not words.",
  ...Object.fromEntries(
    Object.keys(BAD_FIELDS).map((code) => [code, "Something didn't save; check the highlighted field."]),
  ),
};

/** Whether a tab's draft differs from what was last saved: by value, as the save would see it. */
export function draftDirty<T>(draft: T, saved: T): boolean {
  return JSON.stringify(draft) !== JSON.stringify(saved);
}

/** What the last Save came to: nothing yet (or changed since), saved, or refused with a sentence. */
export type SaveStatus = { kind: "saved" } | { kind: "error"; message: string } | null;

/** The line beside a tab's Save button. */
export function saveStatusText(busy: boolean, status: SaveStatus, dirty: boolean): string {
  if (busy) return "Saving…";
  if (status?.kind === "error") return status.message;
  if (status?.kind === "saved") return "Saved.";
  return dirty ? "You have unsaved changes." : "";
}

/**
 * A tab's Save, from the draft to what to show: checked in the browser as
 * the server will check it (a refusal there sends nothing), then posted as
 * the check made it - trimmed, blank goals and trailing blank lines gone -
 * which is also the value the draft becomes. A refusal from the server
 * marks the fields its code is about (`BAD_FIELDS`), if any.
 */
export async function saveDraft<T>(
  draft: T,
  check: (raw: unknown) => Check<T>,
  post: (value: T) => Promise<{ ok: true } | { ok: false; message: string; code: string }>,
): Promise<{ ok: true; value: T } | { ok: false; message: string; fields: readonly DraftField[] }> {
  const checked = check(draft);
  if (!checked.ok) return { ok: false, message: checked.error, fields: [] };
  const result = await post(checked.value);
  if (!result.ok) return { ok: false, message: result.message, fields: BAD_FIELDS[result.code] ?? [] };
  return { ok: true, value: checked.value };
}

/**
 * After removing page `removed`, leaving `left`, the page whose controls
 * take the focus: the one now in its place, else the one before it; null
 * when none are left.
 */
export function pageAfterRemove(removed: number, left: number): number | null {
  return left === 0 ? null : Math.min(removed, left - 1);
}
