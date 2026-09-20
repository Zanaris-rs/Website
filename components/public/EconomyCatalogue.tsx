import ItemIcon from "@/components/game/ItemIcon";
import frame from "@/components/site/Frame.module.css";
import Panel from "@/components/site/Panel";
import { GROUPS, OTHER_GROUP, groupOf, groupRoster } from "@/lib/items/groups";
import { itemName } from "@/lib/items/names";
import { allItemIds, baseIdOf, debugName, isNote, itemCost } from "@/lib/items/objects";
import { type Block, economyBlocks } from "@/lib/public/economy";
import { formatNumber, formatWhen } from "@/lib/public/format";
import { ECONOMY_DEFAULT_WINDOW } from "@/lib/public/queries";
import type { EconomyCatalogue as CatalogueData } from "@/lib/public/read-server";
import { SEARCH_ROWS, searchCensus } from "@/lib/public/search";

import EconomySections from "./EconomySections";
import EconomyGroups from "./EconomyGroups";
import styles from "./Public.module.css";

const CATALOGUE = {
  groupOf,
  baseIdOf,
  name: itemName,
  cost: itemCost,
};

const SEARCH_CATALOGUE = {
  name: itemName,
  debugName,
  groupOf: (id: number) => groupOf(id) ?? OTHER_GROUP,
  isNote,
  baseIdOf,
};

const SPECS = GROUPS.map((group) => ({
  key: group.key,
  label: group.label,
  headline: group.headline,
  roster: groupRoster(group.key),
}));

const GROUP_LABELS: Record<string, string> = Object.fromEntries([
  ...GROUPS.map((group) => [group.key, group.label]),
  [OTHER_GROUP, "Other"],
]);

/**
 * Every object in the game, and a box to find one in.
 *
 * The category blocks answer "what is there a lot of". They cap each category
 * at `BLOCK_ROWS`, which is right for reading and useless for checking: the
 * question somebody actually arrives with is "how many of *this* are there",
 * and for all but the top forty-eight of a category the old page's answer was
 * nothing at all. The search box is that answer.
 *
 * It deliberately does **not** filter the blocks. Running a query through them
 * would leave the cap in place and hide matches behind "top 48 of 1,204" —
 * which is the one part of the page a search exists to reach. A query returns
 * one flat list instead, ordered by how much of the thing there is.
 *
 * The blocks and the search disagree about width on purpose: the blocks are a
 * grid across the frame, because eleven categories down a 500px column was four
 * screens of scrolling, and the results are one column because a list read top
 * to bottom is a list.
 */
export default function EconomyCatalogue({
  catalogue,
  query,
}: {
  catalogue: CatalogueData;
  query: string;
}) {
  const { census } = catalogue;

  const blocks = economyBlocks(census.items, null, SPECS, CATALOGUE, OTHER_GROUP);
  const isCoins = (block: Block) => block.key === "coins";

  const counts = new Map(census.items.map((item) => [item.id, item.count]));
  const results = query
    ? searchCensus(query, allItemIds(), counts, SEARCH_CATALOGUE, SEARCH_ROWS)
    : null;

  return (
    <>
      <EconomySections current="items" window={ECONOMY_DEFAULT_WINDOW} />

      <Panel width="var(--panel-wide)">
        <form action="/economy/items" className={styles.search}>
          <div className={frame.stone}>
            <b>Find an item</b>
            <br />
            <input
              type="text"
              name="q"
              size={24}
              maxLength={64}
              defaultValue={query}
              autoComplete="off"
              aria-label="Item name or id"
            />
            <br />
            <input className={styles.searchButton} type="submit" value="Search" />
          </div>
        </form>
        {results === null ? (
          <p className={styles.note}>
            Search by name, in-game id or internal name e.g.
            &quot;partyhat&quot;, &quot;1042&quot; or &quot;iron_ore&quot;.
            Every item in the game is here, including the items nobody yet owns
            (or can even obtain!).
          </p>
        ) : null}
      </Panel>

      {results === null ? null : (
        <Panel align="left" width="var(--panel-wide)">
          <div className={styles.blockTitle}>
            {results.total === 0
              ? `Nothing matches “${query}”`
              : `${formatNumber(results.total)} ${results.total === 1 ? "item matches" : "items match"} “${query}”`}
          </div>
          {results.total === 0 ? (
            <p className={styles.note}>
              Notes are counted as the item they are a note for, so searching
              for one finds the item itself.{" "}
              <a href="/economy/items" className={frame.link}>
                Everything in the game
              </a>{" "}
              lists every category.
            </p>
          ) : (
            <>
              <div className={styles.scroll}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th colSpan={2}>Item</th>
                      <th>Category</th>
                      <th className={styles.figure}>In the game</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.matches.map((match) => (
                      <tr
                        key={match.id}
                        className={match.count === 0 ? styles.none : undefined}
                      >
                        <td className={styles.icon}>
                          <ItemIcon id={match.id} />
                        </td>
                        <td>{match.name}</td>
                        <td>{GROUP_LABELS[match.group] ?? "Other"}</td>
                        <td className={styles.figure}>
                          {formatNumber(match.count)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {results.total > results.matches.length ? (
                <p className={styles.note}>
                  The closest {results.matches.length} of{" "}
                  {formatNumber(results.total)}. Try a longer query.
                </p>
              ) : null}
              <p className={styles.note}>
                <a href="/economy/items" className={frame.link}>
                  Everything in the game
                </a>{" "}
                — every category, without a search.
              </p>
            </>
          )}
        </Panel>
      )}

      {results !== null ? null : (
      <Panel align="left" width="var(--panel-wide)">
        <div className={styles.blockTitle}>Everything in the game</div>
        <p className={styles.note}>
          Counted {formatWhen(census.takenAt)} across{" "}
          {formatNumber(census.players ?? 0)} save files.
        </p>
        <div className={styles.blocks}>
          <EconomyGroups blocks={blocks.filter((block) => !isCoins(block))} />
        </div>
      </Panel>
      )}
    </>
  );
}
