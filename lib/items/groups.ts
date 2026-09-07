import { allItemIds, baseIdOf, debugName } from "./objects";

/**
 * The census, in categories.
 *
 * /economy counts every object in the game, which is 3,883 rows nobody will
 * read. These are the headings it groups them under — ores, bars, logs, runes
 * and so on — so a reader can ask "how much iron is there" and get an answer
 * without scrolling past nine hundred kinds of arrow.
 *
 * ## Why the grouping lives here and not in the engine
 *
 * Objects do carry a `category=` field, and it is no use for this: it is a
 * script-trigger tag (`door_open_and_close`, `petcat`, `weapon_polearm`), most
 * objects have none, and `ObjType.parse` blanks it entirely on a free world.
 * A taxonomy for a public page is a decision about how to present a census
 * rather than a fact about the game, so it is made here, in a file that a
 * person can read and a test can pin, and `accounts.public_economy_group_range`
 * takes it as an argument. Renaming a category is an edit to this file, not a
 * migration.
 *
 * ## How the rules are written
 *
 * Anchored patterns over the **debugname**, with an explicit `except` where the
 * 2004 data has laid a trap. Every one of these is real:
 *
 *   - `1dose2restore` ends in `ore`, so ores match `_ore` and not `ore`.
 *   - `chocolate_bar` is not a smithing bar.
 *   - eleven `boardgames_runelink_*` pieces are not runes.
 *   - `ground_bat_bones` is a powdered ingredient, not bones.
 *   - `leather_gloves` and `dragonhide_body` are armour; this category is the
 *     material they are made from.
 *
 * The separator convention is not uniform either — runes are `airrune`, ores are
 * `iron_ore` — which is why nothing here tries to be clever about word breaks.
 *
 * ## Notes
 *
 * Every rule runs against the **base** object: `groupOf` resolves a note to what
 * it is a note for before matching, so `cert_iron_ore` is in Ores because
 * `iron_ore` is, with no rule mentioning `cert_` anywhere. A bank note is
 * redeemable one for one, so counting it as a different object would understate
 * the number a reader came for.
 *
 * Pure: no database, no React, and `groupIdMap()` is the whole of what the SQL
 * function is told.
 */

export type GroupKey = string;

type Rule =
  /** A fixed list of base ids. Used where the block must show a line for something that does not exist. */
  | { readonly kind: "roster"; readonly ids: readonly number[] }
  | { readonly kind: "match"; readonly match: RegExp; readonly except?: RegExp };

export type Group = {
  readonly key: GroupKey;
  readonly label: string;
  /**
   * True for a group the page prints as a figure of its own rather than as one
   * block in the list. Only coins: it has its own total and its own chart at the
   * top of the page, and it is a group here so that eleven million of it does
   * not land in "Other items" and drown everything else in it.
   */
  readonly headline?: boolean;
  readonly rule: Rule;
};

/**
 * The reserved key `accounts.public_economy_group_range` answers under for every
 * id no group named. Never a key in `groupIdMap()`; the SQL rejects it as one.
 */
export const OTHER_GROUP: GroupKey = "*";

/**
 * The rares the engine follows one by one, from
 * `engine/data/config/economy.json`.
 *
 * Copied rather than imported: the content repo is not checked out beside this
 * one on a deploy. `groups.test.ts` reads that file when it *is* present and
 * fails on drift, so a rare added to the engine's list cannot silently go
 * missing from this block.
 *
 * A roster and not a pattern, because this is the one block that must print a
 * line for something that does not exist — "Blue partyhat 0" is the most
 * interesting row on the page, and the census only stores ids it counted.
 */
const RARES: readonly number[] = [
  962, // Christmas cracker
  981, // Disk of returning
  1038, // Red partyhat
  1040, // Yellow partyhat
  1042, // Blue partyhat
  1044, // Green partyhat
  1046, // Purple partyhat
  1048, // White partyhat
  1050, // Santa hat
  1053, // Halloween mask (green)
  1055, // Halloween mask (blue)
  1057, // Halloween mask (red)
  1959, // Pumpkin
  1961, // Easter egg
  1989, // Half full wine jug
];

/**
 * Every fish the game has, in whatever state it is in.
 *
 * Raw, cooked and burnt together: a burnt shark is a shark, and a category that
 * dropped it would need a reason that is not "it is spoiled". Species with only
 * one form (`burnt_eel` has no cooked twin here) come along by the same rule.
 */
const FISH = "anchovies|bass|cod|herring|lobster|mackerel|mantaray|pike|salmon|sardine|shark|shrimp|swordfish|trout|tuna|seaturtle|giant_carp|lava_eel|eel";

/** The herbs, clean and grimy. `unidentified_liquid` and `_powder` are quest reagents, not herbs. */
const HERBS = "guam_leaf|marentill|tarromin|harralander|ranarr_weed|irit_leaf|avantoe|kwuarm|cadantine|lantadyme|dwarf_weed|snapdragon|torstol|toadflax";

/** In the order the page prints them. */
export const GROUPS: readonly Group[] = [
  { key: "coins", label: "Coins", headline: true, rule: { kind: "roster", ids: [995] } },
  { key: "rares", label: "Rares", rule: { kind: "roster", ids: RARES } },
  { key: "ores", label: "Ores", rule: { kind: "match", match: /^(.+_ore|coal|clay)$/ } },
  { key: "bars", label: "Bars", rule: { kind: "match", match: /^.+_bar$/, except: /^chocolate_bar$/ } },
  { key: "logs", label: "Logs", rule: { kind: "match", match: /^.*logs$/ } },
  { key: "runes", label: "Runes", rule: { kind: "match", match: /^.+rune$/, except: /^boardgames_/ } },
  { key: "fish", label: "Fish", rule: { kind: "match", match: new RegExp(`^(raw_|burnt_)?(${FISH})$`) } },
  {
    key: "herbs",
    label: "Herbs",
    rule: { kind: "match", match: new RegExp(`^(unidentified_.+|${HERBS})$`), except: /^unidentified_(liquid|powder)$/ },
  },
  {
    key: "gems",
    label: "Gems",
    rule: { kind: "match", match: /^(uncut_)?(sapphire|emerald|ruby|diamond|dragonstone|opal|jade|red_topaz)$/ },
  },
  {
    key: "hides",
    label: "Hides & leather",
    rule: {
      kind: "match",
      match: /^(cow_hide|leather|hard_leather|dragonhide_(black|blue|green|red)|dragon_leather(_black|_blue|_red)?)$/,
    },
  },
  { key: "bones", label: "Bones", rule: { kind: "match", match: /^.*bones$/, except: /^ground_bat_bones$/ } },
];

/** Does this rule claim this base object? Used by `groupOf` and, one rule at a time, by the tests. */
export function ruleClaims(rule: Rule, baseId: number, name: string): boolean {
  if (rule.kind === "roster") return rule.ids.includes(baseId);
  if (name === "") return false;
  if (rule.except?.test(name)) return false;
  return rule.match.test(name);
}

/**
 * Which category an object belongs to, or `null` for one no rule names.
 *
 * Resolved on the base object, so a note is wherever its original is. First
 * match wins; `groups.test.ts` asserts that no object is claimed by two rules,
 * so "first" is never a tie-break in practice.
 */
export function groupOf(id: number): GroupKey | null {
  const baseId = baseIdOf(id);
  const name = debugName(baseId);
  for (const group of GROUPS) {
    if (ruleClaims(group.rule, baseId, name)) return group.key;
  }
  return null;
}

/**
 * The argument for `accounts.public_economy_group_range`: every id the game has,
 * under the key of the category that claims it.
 *
 * Ids and not base ids — the census counts what is in the save file, so the note
 * and the object both have to be in the list for the group's total to match what
 * the page prints. Objects no rule claims are left out entirely and the SQL sums
 * them into `'*'`.
 */
export function groupIdMap(): Record<GroupKey, number[]> {
  const map: Record<GroupKey, number[]> = {};
  for (const group of GROUPS) map[group.key] = [];
  for (const id of allItemIds()) {
    const key = groupOf(id);
    if (key !== null) map[key].push(id);
  }
  return map;
}

/** The base ids a roster group prints a line for, even at zero. `null` for a pattern group. */
export function groupRoster(key: GroupKey): readonly number[] | null {
  const group = GROUPS.find((entry) => entry.key === key);
  return group && group.rule.kind === "roster" ? group.rule.ids : null;
}

/** Everything that lands in "Other items". Pinned by a test, so a content bump has to be looked at. */
export function unclassifiedIds(): number[] {
  return allItemIds().filter((id) => groupOf(id) === null);
}
