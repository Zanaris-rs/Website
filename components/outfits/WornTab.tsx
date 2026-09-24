"use client";

import ItemIcon from "@/components/game/ItemIcon";
import Tile from "@/components/site/Tile";
import { itemName } from "@/lib/items/names";
import { TAB_SIZE, TAB_SLOTS, wornSrc } from "@/lib/chathead/wearables";

import styles from "./Outfits.module.css";

/**
 * The Worn Equipment tab, as the game draws it: the side panel's stone with
 * the slot boxes and lines (`public/img/game/worn/tab.png`), each slot's
 * silhouette when it is empty and the item's icon when it is not. Every slot
 * is a button that opens the picker for it.
 */
export default function WornTab({
  worn,
  picking,
  onPick,
}: {
  worn: readonly number[];
  picking: number | null;
  onPick: (slot: number) => void;
}) {
  return (
    <div
      className={styles.tab}
      style={{
        width: TAB_SIZE.width,
        height: TAB_SIZE.height,
        backgroundImage: `url(${wornSrc("tab")})`,
      }}
    >
      {TAB_SLOTS.map(({ slot, name, x, y }) => {
        const obj = worn[slot] ?? -1;
        const label = obj === -1 ? `${name}: empty` : `${name}: ${itemName(obj)}`;
        return (
          <button
            key={slot}
            type="button"
            className={styles.slot}
            style={{ left: x, top: y }}
            onClick={() => onPick(slot)}
            aria-pressed={picking === slot}
            aria-label={label}
            title={label}
          >
            {obj === -1 ? (
              <Tile src={wornSrc(`slot-${slot}`)} width={32} height={32} />
            ) : (
              <ItemIcon id={obj} alt="" />
            )}
          </button>
        );
      })}
    </div>
  );
}
