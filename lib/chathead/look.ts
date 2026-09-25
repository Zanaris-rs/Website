/**
 * A player's look, as the save file holds it, and the twelve appearance
 * slots the game builds from it.
 *
 * The shape is the save's (`engine/src/engine/entity/Player.ts`): a gender,
 * seven identity kits, five colour indexes and the worn inventory. It is what
 * an outfit stores and what "import from in-game" copies, so everything that
 * draws a player starts here.
 */

export type Look = {
  /** 0 male, 1 female. */
  gender: number;
  /**
   * Identity kit ids (`idk`), -1 for none, in the save's order: hair, jaw,
   * torso, arms, hands, legs, feet.
   */
  kits: readonly number[];
  /** Colour indexes, in order hair, torso, legs, feet, skin. 0 = as modelled. */
  colours: readonly number[];
  /** Object id worn in each equipment slot (`wearpos`), -1 for empty. */
  worn: readonly number[];
};

/** The appearance slot each of `Look.kits` fills (`Player.getAppearanceInSlot`). */
export const KIT_SLOTS: readonly number[] = [8, 11, 4, 6, 9, 7, 10];

/** Appearance values: `KIT + id` is a kit, `OBJ + id` a worn object, 0 nothing. */
export const KIT = 0x100;
export const OBJ = 0x200;

/**
 * The twelve appearance slots, exactly as the server sends them
 * (`Player.generateAppearance`): a worn object wins its slot, a kit fills a
 * slot nothing is worn in, and any slot a worn object's `wearpos2`/`wearpos3`
 * names is left empty — the hair and beard under a full helm.
 *
 * `hides` maps an object id to the slots it empties. Objects missing from it
 * empty nothing, which is right for every object that is not in it: for a
 * chathead the build writes every object that empties a slot the head can
 * show (`heads.json`), and for a figure every object that empties any slot
 * (`bodies.json`).
 */
export function toAppearance(
  look: Look,
  hides: Readonly<Record<string, readonly number[]>>,
): number[] {
  const skipped = new Set<number>();
  for (const obj of look.worn) {
    if (obj < 0) continue;
    for (const slot of hides[obj] ?? []) skipped.add(slot);
  }

  const appearance: number[] = [];
  for (let slot = 0; slot < 12; slot++) {
    const worn = look.worn[slot] ?? -1;
    const kitIndex = KIT_SLOTS.indexOf(slot);
    const kit = kitIndex === -1 ? -1 : (look.kits[kitIndex] ?? -1);

    if (skipped.has(slot)) {
      appearance.push(0);
    } else if (worn >= 0) {
      appearance.push(OBJ + worn);
    } else if (kit >= 0) {
      appearance.push(KIT + kit);
    } else {
      appearance.push(0);
    }
  }
  return appearance;
}

/**
 * The look with only what its chathead shows still worn: every object with a
 * head model (`objs`) or that empties a slot the head shows (`hides`) stays,
 * everything else comes off. It draws the same chathead - the objects taken
 * off have no head to draw - and says nothing about the rest of what the
 * player had on, which is what a look from the game must not publish.
 */
export function headOnly(
  look: Look,
  tables: {
    objs: Readonly<Record<string, unknown>>;
    hides: Readonly<Record<string, readonly number[]>>;
  },
): Look {
  return {
    ...look,
    worn: look.worn.map((obj) =>
      obj >= 0 && (obj in tables.objs || obj in tables.hides) ? obj : -1,
    ),
  };
}

/** A stable string for a look, for caching one drawing per distinct look. */
export function lookKey(look: Look): string {
  return [
    look.gender,
    look.kits.join(","),
    look.colours.join(","),
    look.worn.join(","),
  ].join("|");
}
