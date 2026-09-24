"use client";

import { useMemo, useState } from "react";

import ItemIcon from "@/components/game/ItemIcon";
import { TAB_SLOTS, wearables } from "@/lib/chathead/wearables";
import { itemName } from "@/lib/items/names";

import styles from "./Outfits.module.css";

/** How many matches the list shows before asking for a narrower search. */
const SHOWN = 80;

/**
 * Everything that can be worn in one slot, searchable by name. Anyone may
 * wear anything: the list is every object the game lets into the slot, not
 * what the player owns.
 */
export default function ItemPicker({
  slot,
  worn,
  onWear,
  onClose,
}: {
  slot: number;
  worn: number;
  onWear: (obj: number) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const slotName = TAB_SLOTS.find((entry) => entry.slot === slot)?.name ?? "";

  const items = useMemo(
    () =>
      (wearables.slots[slot] ?? [])
        .map((id) => ({ id, name: itemName(id) }))
        .sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id),
    [slot],
  );
  const needle = query.trim().toLowerCase();
  const matches = needle
    ? items.filter((item) => item.name.toLowerCase().includes(needle))
    : items;

  return (
    <div className={styles.picker} role="dialog" aria-label={`${slotName} slot`}>
      <div className={styles.pickerHead}>
        <b>{slotName}</b>
        <input
          type="search"
          className={styles.search}
          placeholder={`Search ${items.length} items`}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          autoFocus
        />
        {worn !== -1 ? (
          <button type="button" onClick={() => onWear(-1)}>
            Take off
          </button>
        ) : null}
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
      <ul className={styles.items}>
        {matches.slice(0, SHOWN).map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className={styles.item}
              aria-pressed={item.id === worn}
              onClick={() => onWear(item.id)}
            >
              <ItemIcon id={item.id} />
              <span>{item.name}</span>
            </button>
          </li>
        ))}
      </ul>
      {matches.length > SHOWN ? (
        <p className={styles.more}>
          {matches.length - SHOWN} more — type to narrow the list.
        </p>
      ) : null}
      {matches.length === 0 ? (
        <p className={styles.more}>Nothing in this slot is called that.</p>
      ) : null}
    </div>
  );
}
