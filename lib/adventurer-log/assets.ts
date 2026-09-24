import { itemIconSrc } from "@/lib/items/icons";
import { itemName } from "@/lib/items/names";
import { allItemIds, debugName, isNote } from "@/lib/items/objects";
import { SKILLS } from "@/lib/skills/icons";

/**
 * The picker's search: items and skills whose names contain the query, as the
 * shortcode to put in a post. Only the assets route calls it, so the browser
 * never loads the item tables; the composer asks as the player types.
 */

export type AssetMatch =
  | { kind: "item"; code: string; name: string; id: number }
  | { kind: "skill"; code: string; name: string; stat: number };

export const ASSET_RESULTS = 24;

export function searchAssets(raw: string): AssetMatch[] {
  const q = raw.trim().toLowerCase();
  if (q.length < 2 || q.length > 40) return [];

  const skills: AssetMatch[] = SKILLS.filter((skill) => skill.name.toLowerCase().includes(q)).map((skill) => ({
    kind: "skill",
    code: `[skill:${skill.name.toLowerCase()}]`,
    name: skill.name,
    stat: skill.id,
  }));

  const items: AssetMatch[] = [];
  for (const id of allItemIds()) {
    if (items.length >= ASSET_RESULTS) break;
    if (isNote(id) || itemIconSrc(id) === null) continue;
    const name = itemName(id);
    if (!name.toLowerCase().includes(q)) continue;
    const code = debugName(id);
    if (!/^[a-z0-9_]{1,40}$/.test(code)) continue;
    items.push({ kind: "item", code: `[item:${code}]`, name, id });
  }

  // Names that start with the query first, then the rest, each shortest first.
  const rank = (match: AssetMatch) => (match.name.toLowerCase().startsWith(q) ? 0 : 1);
  return [...skills, ...items]
    .sort((a, b) => rank(a) - rank(b) || a.name.length - b.name.length || a.name.localeCompare(b.name))
    .slice(0, ASSET_RESULTS);
}
