import { GOD_NAMES, type DialoguePage, type Persona, PLAYSTYLE_NAMES, type Playstyle } from "./persona";
import { placeName } from "./places";

/**
 * What the character card draws where the figure goes (the spec's table):
 * a saved outfit is drawn whole; without one, the headline or dialogue get a
 * chat strip under the title and the chathead lives in the dialogue box;
 * with neither, the card keeps today's chathead.
 */
export function cardMode(input: { hasOutfit: boolean; headline: string; pages: readonly DialoguePage[] }):
  "figure" | "strip" | "chathead" {
  if (input.hasOutfit) return "figure";
  return input.headline !== "" || input.pages.length > 0 ? "strip" : "chathead";
}

export type SheetRow =
  | { key: "home" | "hangout" | "god" | "clan" | "style"; label: string; value: string }
  | { key: "goals"; label: string; value: string[] };

export function sheetRows(persona: Persona): SheetRow[] {
  const rows: SheetRow[] = [];
  const home = placeName(persona.homeTown);
  if (home) rows.push({ key: "home", label: "Home", value: home });
  if (persona.hangout) rows.push({ key: "hangout", label: "Hangout", value: persona.hangout });
  if (persona.god) rows.push({ key: "god", label: "God", value: GOD_NAMES[persona.god] });
  if (persona.clan) rows.push({ key: "clan", label: "Clan", value: persona.clan });
  const style = persona.playstyle && PLAYSTYLE_NAMES[persona.playstyle as Playstyle];
  if (style) rows.push({ key: "style", label: "Style", value: style });
  if (persona.goals.length > 0) rows.push({ key: "goals", label: "Goals", value: persona.goals });
  return rows;
}
