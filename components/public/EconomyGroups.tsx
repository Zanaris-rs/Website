import ItemIcon from "@/components/game/ItemIcon";
import { itemName } from "@/lib/items/names";
import type { Block } from "@/lib/public/economy";
import { formatNumber } from "@/lib/public/format";

import styles from "./Public.module.css";

/** "1 item", "48 items". A page that says "1 items" reads as a machine wrote it. */
function items(n: number): string {
  return `${formatNumber(n)} ${n === 1 ? "item" : "items"}`;
}

/**
 * What a block is worth, or nothing at all.
 *
 * `value` is `null` when not one object in the block declares a price, which is
 * the rares block: `ObjType.cost` defaults to 1, so a partyhat's "value" would
 * be one coin, and a shop value of "15 gp" against fifteen partyhats is worse
 * than no shop value. When only some of the block could be priced the phrase
 * says so rather than quietly reporting a total that is missing objects.
 */
function value(block: Block) {
  if (block.value === null) return null;
  const partial = block.priced < block.counted;
  return (
    <>
      {" · "}shop value {formatNumber(block.value)} gp
      {partial ? (
        <span className={styles.unpriced}>
          {" "}
          (priced from {block.priced} of {block.counted})
        </span>
      ) : null}
    </>
  );
}

/**
 * One category of the census: what it holds, and how much of each.
 *
 * Laid out **across** rather than down. A column of two-cell rows works when
 * every category is the same length and these are not: eleven of them at
 * wildly different heights left the page full of ragged whitespace, the
 * headings lost among their own rows, and a reader scrolling past a category
 * with two items in it to reach one with forty-eight. Wrapped rows of
 * icon-name-count sit at whatever height each category needs and put the
 * headings where they can be seen.
 *
 * No low and high line. It reported a range over a window this page cannot
 * show, printed between two categories where it looked like it belonged to
 * either, and said nothing a reader could do anything with — the shape over
 * time is what that wanted to be, and `public_economy` does not return the
 * per-category history it would need.
 *
 * Rows are already ordered and capped by `economyBlocks`; nothing here decides
 * anything, which is why none of it needs a test of its own.
 */
export default function EconomyGroups({ blocks }: { blocks: readonly Block[] }) {
  return (
    <>
      {blocks.map((block) => (
        <div key={block.key} className={styles.group}>
          <div className={styles.groupTitle}>{block.label}</div>
          <div className={styles.groupMeta}>
            {items(block.count)}
            {value(block)}
            {block.items.length < block.of ? (
              <span className={styles.unpriced}>
                {" "}
                (top {block.items.length} of {formatNumber(block.of)})
              </span>
            ) : null}
          </div>

          {block.items.length === 0 ? (
            <div className={styles.empty}>Nothing of this kind exists yet.</div>
          ) : (
            <ul className={styles.tiles}>
              {block.items.map((item) => (
                <li
                  key={item.id}
                  className={item.count === 0 ? styles.none : undefined}
                >
                  <ItemIcon id={item.id} />
                  <span className={styles.tileName}>{itemName(item.id)}</span>
                  <b className={styles.tileCount}>{formatNumber(item.count)}</b>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </>
  );
}
