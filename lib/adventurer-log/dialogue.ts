import type { DialoguePage, Persona } from "./persona";

/**
 * What the dialogue box says: the owner's pages; with none, their headline as
 * one neutral page (plain text - its colour and effect are overhead chat's);
 * with neither, nothing, and the box is not drawn.
 */
export function dialoguePages(persona: Persona, headline: string): DialoguePage[] {
  if (persona.dialogue.length > 0) return persona.dialogue;
  return headline ? [{ mood: "neutral", emote: null, lines: [headline] }] : [];
}
