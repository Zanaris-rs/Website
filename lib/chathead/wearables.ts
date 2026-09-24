import json from "./wearables.json";

/**
 * The outfit editor's picture of the Worn Equipment tab, and what can go in
 * each slot. Exported with the chathead by `npm run chathead:update`
 * (`scripts/chathead/outfits.ts`).
 */

export type Wearables = {
  /** Changes whenever the tab pictures or these lists do. */
  version: string;
  /** Every object that can be worn, by the slot it is worn in (`wearpos`). */
  slots: Readonly<Record<string, readonly number[]>>;
  /** Colour swatches as 0xRRGGBB, `palettes[part][index]`, as `Look.colours`. */
  palettes: readonly (readonly number[])[];
};

export const wearables = json as Wearables;

/**
 * The slots the tab shows, with where the icon sits in it — the inventory
 * component in `content/scripts/player/interfaces/wornitems.if`, grid
 * position plus that slot's offset. Arms, hair and jaw are body parts, set
 * by kits, and have no place on the tab.
 */
export const TAB_SLOTS: readonly {
  slot: number;
  name: string;
  x: number;
  y: number;
}[] = [
  { slot: 0, name: "Head", x: 80, y: 6 },
  { slot: 1, name: "Cape", x: 39, y: 45 },
  { slot: 2, name: "Neck", x: 80, y: 45 },
  { slot: 13, name: "Ammo", x: 121, y: 45 },
  { slot: 3, name: "Weapon", x: 24, y: 84 },
  { slot: 4, name: "Body", x: 80, y: 84 },
  { slot: 5, name: "Shield", x: 136, y: 84 },
  { slot: 7, name: "Legs", x: 80, y: 124 },
  { slot: 9, name: "Hands", x: 24, y: 164 },
  { slot: 10, name: "Feet", x: 80, y: 164 },
  { slot: 12, name: "Ring", x: 136, y: 164 },
];

export const TAB_SIZE = { width: 190, height: 202 } as const;

/** The tab picture, or one slot's empty silhouette, versioned for the cache. */
export function wornSrc(name: "tab" | `slot-${number}`): string {
  return `/img/game/worn/${name}.png?v=${wearables.version}`;
}

/** Whether an object can be worn in a slot. */
export function wearableIn(slot: number, obj: number): boolean {
  return wearables.slots[slot]?.includes(obj) ?? false;
}

export function swatchCss(rgb: number): string {
  return `#${rgb.toString(16).padStart(6, "0")}`;
}
