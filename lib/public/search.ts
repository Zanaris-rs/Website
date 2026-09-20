/**
 * Looking one item up in the census.
 *
 * The category blocks answer "what is there a lot of"; this answers "how much
 * of *that* is there", which is the question somebody checking a claim
 * actually has. It is deliberately not the blocks with a filter on them: the
 * blocks cap each category at `BLOCK_ROWS`, and a search that could only reach
 * the top 48 of a category would be a search that hides the tail — which is
 * the only part you need a search for.
 *
 * Pure, and it takes its catalogue as an argument, for `economyBlocks`'s
 * reason: the rules below are readable against five made-up objects and
 * unreadable against 3,883 real ones.
 */

/** How much of a query is a query. Nobody types more than this. */
export const ITEM_QUERY_MAX = 64;

/** How many rows one search prints before it says how many more it found. */
export const SEARCH_ROWS = 100;

export type ItemMatch = {
  readonly id: number;
  readonly name: string;
  readonly count: number;
  /** The category key the item belongs to, so a flat list can still say where. */
  readonly group: string;
};

export type SearchCatalogue = {
  name: (id: number) => string;
  debugName: (id: number) => string;
  groupOf: (id: number) => string;
  isNote: (id: number) => boolean;
  baseIdOf: (id: number) => number;
};

/**
 * `?q=` as a string, whatever arrived.
 *
 * Total, like `parseSince` and the table params: a query string is the one
 * input on this page a stranger controls, and a page that throws on a repeated
 * parameter is a page anybody can turn into a 500 with a link.
 */
export function parseItemQuery(raw: string | string[] | undefined): string {
  const first = Array.isArray(raw) ? raw[0] : raw;
  if (typeof first !== "string") return "";
  return first.trim().slice(0, ITEM_QUERY_MAX);
}

/** Lowercase, underscores as spaces, one space between words. */
function normalise(text: string): string {
  return text.toLowerCase().replace(/_/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * How well a haystack answers a needle, or 0 for not at all.
 *
 * Three tiers, because substring alone puts `Bar magnet` level with `Iron bar`
 * for `bar` and the reader has to scan past it: the whole name, then a word
 * starting with it, then anywhere inside.
 */
function score(haystack: string, needle: string): number {
  if (!haystack) return 0;
  if (haystack === needle) return 3;
  if (new RegExp(`\\b${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(haystack))
    return 2;
  return haystack.includes(needle) ? 1 : 0;
}

/**
 * Every object whose name, debug name or id answers the query.
 *
 * It walks the **object table**, not the census, and that is not a detail. The
 * census writes only what it found — `toCounts` in the engine fills zeros for
 * the tracked rares and for nothing else — so an object nobody in the game owns
 * is *absent* from it rather than present at zero. Searching the census would
 * answer "blue partyhat" with silence, when the true answer, and the most
 * interesting row this page can print, is nought.
 *
 * Notes are skipped rather than matched: a note is counted as the item it is a
 * note for everywhere else on the page, so a row of its own here would be the
 * same items twice under two names.
 */
export function searchCensus(
  query: string,
  ids: readonly number[],
  counts: ReadonlyMap<number, number>,
  catalogue: SearchCatalogue,
  limit: number = SEARCH_ROWS,
): { matches: ItemMatch[]; total: number } {
  const needle = normalise(query);
  if (!needle) return { matches: [], total: 0 };

  const byId = /^\d+$/.test(needle) ? Number(needle) : null;
  const found: { match: ItemMatch; rank: number }[] = [];

  for (const id of ids) {
    if (catalogue.isNote(id)) continue;

    const name = catalogue.name(id);
    const rank =
      byId === id
        ? 4
        : Math.max(
            score(normalise(name), needle),
            score(normalise(catalogue.debugName(id)), needle),
          );
    if (rank === 0) continue;

    found.push({
      rank,
      match: {
        id,
        name,
        count: counts.get(id) ?? 0,
        group: catalogue.groupOf(id),
      },
    });
  }

  // Best match first, then the most of it, then by id so a tie is stable
  // between one render and the next rather than however the ids arrived.
  found.sort(
    (a, b) =>
      b.rank - a.rank ||
      b.match.count - a.match.count ||
      a.match.id - b.match.id,
  );

  return {
    matches: found.slice(0, limit).map((entry) => entry.match),
    total: found.length,
  };
}
