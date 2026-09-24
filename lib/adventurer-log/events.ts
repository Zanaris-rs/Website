import { itemName } from "@/lib/items/names";
import { allItemIds } from "@/lib/items/objects";

import { skillByName } from "./body";

/**
 * The picture beside an adventure: a level-up's skill, a drop's item, a
 * casket for a clue. Worked out from the line's wording, on the server, the
 * same way the login server filed it (engine `Adventure.ts`); a line it
 * cannot place has no picture and is still shown.
 */

export type EventIcon =
  | { type: "skill"; stat: number }
  | { type: "item"; id: number }
  | null;

/** Casket: what a finished clue scroll hands over. */
const CASKET = 405;

let itemsByName: Map<string, number> | null = null;

/**
 * The object the game calls `name`. `names.json` tells same-named objects
 * apart with a suffix - "Clue scroll (trail easy simple001)" - so a name that
 * is not there as it stands is matched to the first object whose name is
 * that plus a suffix.
 */
export function itemByName(name: string): number | null {
  if (!itemsByName) {
    itemsByName = new Map();
    for (const id of allItemIds()) {
      const full = itemName(id);
      if (!itemsByName.has(full)) itemsByName.set(full, id);
      const bare = full.replace(/ \([^)]*\)$/, "");
      if (bare !== full && !itemsByName.has(bare)) itemsByName.set(bare, id);
    }
  }
  return itemsByName.get(name) ?? null;
}

export function eventIcon(category: number, text: string): EventIcon {
  if (category === 1) {
    const match = /^Levelled up (\w+) from/.exec(text);
    const skill = match ? skillByName(match[1]) : null;
    return skill ? { type: "skill", stat: skill.id } : null;
  }
  if (category === 4) {
    const match = / and received an? (.+)!$/.exec(text);
    const id = match ? itemByName(match[1]) : null;
    return id === null ? null : { type: "item", id };
  }
  if (category === 5) {
    return { type: "item", id: CASKET };
  }
  return null;
}
