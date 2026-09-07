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
 * One category of the census: what it holds, what that is worth, and how far it
 * has moved over the window.
 *
 * The low and high line is the same `.chartScale` the charts print their own
 * scale in, because it is the same idea — the numbers either side of what is
 * being shown. A block whose range could not be read prints no line rather than
 * printing zeroes.
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
            <table className={styles.table}>
              <tbody>
                {block.items.map((item) => (
                  <tr key={item.id} className={item.count === 0 ? styles.none : undefined}>
                    <td>{itemName(item.id)}</td>
                    <td className={styles.groupCount}>{formatNumber(item.count)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {block.low === null || block.high === null ? null : (
            <div className={styles.chartScale}>
              <span>low {formatNumber(block.low)}</span>
              <span>high {formatNumber(block.high)}</span>
            </div>
          )}
        </div>
      ))}
    </>
  );
}
