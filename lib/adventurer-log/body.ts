import { itemName } from "@/lib/items/names";
import { allItemIds, debugName } from "@/lib/items/objects";

import { skillByName } from "./skill-name";

/**
 * Update and reply text, with the game's pictures in it.
 *
 * A post is plain text; `[item:rune_platebody]` (an object's debug name) and
 * `[skill:woodcutting]` become that item's or skill's icon. Nothing else is
 * markup: no HTML, no Markdown, no links. A code nobody knows stays as the
 * text it was, and a post shows at most MAX_ASSETS pictures - the rest stay
 * text too.
 *
 * Parsed on the server, so the pages and the "load more" answer carry tokens
 * and the item tables never reach the browser.
 */

export type BodyToken =
  | { t: "text"; v: string }
  | { t: "item"; id: number; name: string }
  | { t: "skill"; stat: number; name: string };

export const MAX_ASSETS = 20;

const CODE = /\[(item|skill):([a-z0-9_]{1,40})\]/g;

let itemsByDebugName: Map<string, number> | null = null;

function itemByDebugName(name: string): number | null {
  if (!itemsByDebugName) {
    itemsByDebugName = new Map();
    for (const id of allItemIds()) {
      const debug = debugName(id);
      if (!itemsByDebugName.has(debug)) itemsByDebugName.set(debug, id);
    }
  }
  return itemsByDebugName.get(name) ?? null;
}

export { skillByName };

export function parseBody(text: string): BodyToken[] {
  const tokens: BodyToken[] = [];
  let assets = 0;
  let at = 0;

  const pushText = (value: string) => {
    if (value === "") return;
    const last = tokens[tokens.length - 1];
    if (last?.t === "text") last.v += value;
    else tokens.push({ t: "text", v: value });
  };

  for (const match of text.matchAll(CODE)) {
    const [whole, kind, name] = match;
    const start = match.index;
    pushText(text.slice(at, start));
    at = start + whole.length;

    if (assets >= MAX_ASSETS) {
      pushText(whole);
      continue;
    }

    if (kind === "item") {
      const id = itemByDebugName(name);
      if (id === null) {
        pushText(whole);
      } else {
        tokens.push({ t: "item", id, name: itemName(id) });
        assets++;
      }
    } else {
      const skill = skillByName(name);
      if (!skill) {
        pushText(whole);
      } else {
        tokens.push({ t: "skill", stat: skill.id, name: skill.name });
        assets++;
      }
    }
  }
  pushText(text.slice(at));
  return tokens;
}

/** A post's words for a one-line summary: pictures by name, cut at `max`. */
export function excerpt(body: string, max = 90): string {
  const text = parseBody(body)
    .map((token) => (token.t === "text" ? token.v : token.name))
    .join("")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}
