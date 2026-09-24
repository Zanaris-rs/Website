import type { HeadTables } from "./head.ts";
import heads from "./heads.json";
import type { Look } from "./look.ts";
import { wearableIn } from "./wearables.ts";

/**
 * Whether a look is one the game could have produced, apart from where the
 * clothes came from: anyone may wear anything, but only in a slot it is worn
 * in, and only with a body the design screen would have let them make.
 *
 * The body rules are the engine's own (`IdkSaveDesignHandler`): each kit is
 * selectable and of its part for this gender, except that a woman may have
 * no jaw; each colour index is in its palette. The server calls this before
 * saving an outfit, and the editor calls it too so it never offers a save the
 * server would refuse.
 */

const tables = heads as HeadTables;

export const OUTFIT_SLOTS = 10;
export const OUTFIT_NAME_MAX = 32;

export type Outfit = { name: string; look: Look };

export type OutfitCheck =
  | { ok: true; outfit: Outfit }
  | { ok: false; error: string };

function isIntArray(value: unknown, length: number): value is number[] {
  return (
    Array.isArray(value) &&
    value.length === length &&
    value.every((n) => Number.isInteger(n))
  );
}

export function checkLook(value: unknown): string | null {
  if (typeof value !== "object" || value === null) return "look is missing";
  const look = value as Record<string, unknown>;

  if (look.gender !== 0 && look.gender !== 1) return "gender must be 0 or 1";
  const gender = look.gender;

  if (!isIntArray(look.kits, 7)) return "kits must be 7 whole numbers";
  for (let part = 0; part < 7; part++) {
    const id = look.kits[part];
    if (gender === 1 && part === 1 && id === -1) continue; // no jaw
    const kit = tables.kits[id];
    if (!kit || !kit.selectable || kit.part !== part + 7 * gender) {
      return `kit ${id} is not a ${gender ? "female" : "male"} choice for part ${part}`;
    }
  }

  if (!isIntArray(look.colours, 5)) return "colours must be 5 whole numbers";
  for (let part = 0; part < 5; part++) {
    const colour = look.colours[part];
    if (colour < 0 || colour >= tables.recol1d[part].length) {
      return `colour ${colour} is not in palette ${part}`;
    }
  }

  if (!isIntArray(look.worn, 14)) return "worn must be 14 whole numbers";
  for (let slot = 0; slot < 14; slot++) {
    const obj = look.worn[slot];
    if (obj !== -1 && !wearableIn(slot, obj)) {
      return `object ${obj} is not worn in slot ${slot}`;
    }
  }

  return null;
}

export function checkOutfit(value: unknown): OutfitCheck {
  if (typeof value !== "object" || value === null) {
    return { ok: false, error: "outfit is missing" };
  }
  const outfit = value as Record<string, unknown>;

  if (typeof outfit.name !== "string") {
    return { ok: false, error: "name must be text" };
  }
  const name = outfit.name.trim();
  if (name.length === 0 || name.length > OUTFIT_NAME_MAX) {
    return { ok: false, error: `name must be 1 to ${OUTFIT_NAME_MAX} characters` };
  }
  if (/[\u0000-\u001f\u007f]/.test(name)) {
    return { ok: false, error: "name has a control character in it" };
  }

  const error = checkLook(outfit.look);
  if (error) return { ok: false, error };

  const look = outfit.look as Look;
  return {
    ok: true,
    outfit: {
      name,
      look: {
        gender: look.gender,
        kits: [...look.kits],
        colours: [...look.colours],
        worn: [...look.worn],
      },
    },
  };
}

/** The design screen's defaults: each part's first selectable kit (`validateIdkDesign`). */
export function defaultLook(gender: number): Look {
  const kits = [0, 1, 2, 3, 4, 5, 6].map((part) =>
    tables.kits.findIndex((k) => k.part === part + 7 * gender && k.selectable),
  );
  return {
    gender,
    kits,
    colours: [0, 0, 0, 0, 0],
    worn: new Array(14).fill(-1),
  };
}

/** The kits the design screen offers for one part, in its cycling order. */
export function kitChoices(gender: number, part: number): number[] {
  const out: number[] = [];
  tables.kits.forEach((kit, id) => {
    if (kit.selectable && kit.part === part + 7 * gender) out.push(id);
  });
  return out;
}
