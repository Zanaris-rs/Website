import type { Statement } from "@/lib/account/register";
import type { Look } from "@/lib/chathead/look";
import type { SavedOutfits } from "@/lib/chathead/outfit-store";
import type { Outfit } from "@/lib/chathead/validate";

// A value import, so a relative path with its extension: db-check runs this
// file under node's type stripping, which knows neither `@/` nor JSON imports.
import { OUTFIT_SLOTS } from "../chathead/limits.ts";

/**
 * Every call into migration 12's outfit functions, and the parsing of what
 * they answer. The same discipline as `lib/records/queries.ts`: statements are
 * `{ text, values }` with nothing interpolated, and a result string nobody
 * documented throws instead of being guessed at.
 *
 * The database checks an outfit's shape and ranges; whether each kit and
 * object is a real choice is `lib/chathead/validate.ts`, which the routes run
 * first. The username is always the verified session's.
 */

function asRecord(row: unknown): Record<string, unknown> | null {
  return typeof row === "object" && row !== null
    ? (row as Record<string, unknown>)
    : null;
}

function asIntArray(value: unknown, length: number, where: string): number[] {
  if (
    Array.isArray(value) &&
    value.length === length &&
    value.every((n) => Number.isInteger(n))
  ) {
    return value as number[];
  }
  throw new Error(`${where}: not ${length} whole numbers: ${JSON.stringify(value)}`);
}

function asIso(value: unknown): string | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  if (typeof value === "string" && value !== "") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  return null;
}

/** A look out of a row's `gender`, `kits`, `colours` and `worn` columns. */
export function parseLook(row: Record<string, unknown>, where: string): Look {
  const gender = row.gender;
  if (gender !== 0 && gender !== 1) {
    throw new Error(`${where}: gender ${JSON.stringify(gender)}`);
  }
  return {
    gender,
    kits: asIntArray(row.kits, 7, `${where} kits`),
    colours: asIntArray(row.colours, 5, `${where} colours`),
    worn: asIntArray(row.worn, 14, `${where} worn`),
  };
}

// --- the owner's list ----------------------------------------------------------

export function outfitsStatement(username: string): Statement {
  return {
    text: "select * from accounts.outfits($1)",
    values: [username],
  };
}

/** The player's rows as the editor's ten slots and which is the default. */
export function parseOutfits(rows: readonly unknown[]): SavedOutfits {
  const outfits: (Outfit | null)[] = new Array(OUTFIT_SLOTS).fill(null);
  let defaultSlot: number | null = null;

  for (const raw of rows) {
    const row = asRecord(raw);
    if (!row) throw new Error("outfits: not a row");

    const slot = row.slot;
    if (!Number.isInteger(slot) || (slot as number) < 0 || (slot as number) >= OUTFIT_SLOTS) {
      throw new Error(`outfits: slot ${JSON.stringify(slot)}`);
    }
    if (typeof row.name !== "string") throw new Error("outfits: name");

    outfits[slot as number] = { name: row.name, look: parseLook(row, "outfits") };
    if (row.is_default === true) defaultSlot = slot as number;
  }

  return { outfits, defaultSlot };
}

// --- writes ---------------------------------------------------------------------

export type OutfitWriteResult =
  | "ok"
  | "not_found"
  | "banned"
  | "bad_slot"
  | "bad_name"
  | "bad_look"
  | "empty";

const WRITE_RESULTS: readonly OutfitWriteResult[] = [
  "ok",
  "not_found",
  "banned",
  "bad_slot",
  "bad_name",
  "bad_look",
  "empty",
];

export function parseOutfitWrite(raw: unknown, where: string): OutfitWriteResult {
  if (typeof raw === "string" && (WRITE_RESULTS as readonly string[]).includes(raw)) {
    return raw as OutfitWriteResult;
  }
  throw new Error(`${where} returned ${JSON.stringify(raw)}`);
}

export function outfitSaveStatement(
  username: string,
  slot: number,
  outfit: Outfit,
): Statement {
  const { look } = outfit;
  return {
    text: "select accounts.outfit_save($1, $2, $3, $4, $5::int[], $6::int[], $7::int[]) as result",
    values: [
      username,
      slot,
      outfit.name,
      look.gender,
      [...look.kits],
      [...look.colours],
      [...look.worn],
    ],
  };
}

export function outfitDeleteStatement(username: string, slot: number): Statement {
  return {
    text: "select accounts.outfit_delete($1, $2) as result",
    values: [username, slot],
  };
}

export function outfitSetDefaultStatement(
  username: string,
  slot: number,
): Statement {
  return {
    text: "select accounts.outfit_set_default($1, $2) as result",
    values: [username, slot],
  };
}

// --- import from game ----------------------------------------------------------

export type ImportedLook =
  | { result: "ok"; look: Look; savedAt: string | null }
  | { result: "not_found" | "no_look" };

export function outfitImportStatement(username: string): Statement {
  return {
    text: "select * from accounts.outfit_import_look($1)",
    values: [username],
  };
}

export function parseOutfitImport(rows: readonly unknown[]): ImportedLook {
  if (rows.length !== 1) {
    throw new Error(`outfit_import_look returned ${rows.length} rows; always one`);
  }
  const row = asRecord(rows[0]);
  if (!row) throw new Error("outfit_import_look: not a row");

  if (row.result === "ok") {
    return {
      result: "ok",
      look: parseLook(row, "outfit_import_look"),
      savedAt: asIso(row.saved_at),
    };
  }
  if (row.result === "not_found" || row.result === "no_look") {
    return { result: row.result };
  }
  throw new Error(`outfit_import_look returned ${JSON.stringify(row.result)}`);
}

// --- the public read -----------------------------------------------------------

/** How many names one call may ask about; the function ignores the rest. */
export const DEFAULT_LOOKS_MAX = 100;

export function defaultLooksStatement(usernames: readonly string[]): Statement {
  return {
    text: "select * from accounts.outfit_default_looks($1::text[])",
    values: [usernames.slice(0, DEFAULT_LOOKS_MAX)],
  };
}

export function parseDefaultLooks(rows: readonly unknown[]): Map<string, Look> {
  const looks = new Map<string, Look>();
  for (const raw of rows) {
    const row = asRecord(raw);
    if (!row || typeof row.username !== "string") {
      throw new Error("outfit_default_looks: not a row");
    }
    looks.set(row.username, parseLook(row, "outfit_default_looks"));
  }
  return looks;
}

// --- HTTP -------------------------------------------------------------------------

/**
 * What each answer means to the editor. A refused shape is 400 - the page
 * checks the same things first, so reaching the database with one means a
 * page out of step with the database; `empty` is 409, the slot's state;
 * `banned` is 403.
 */
export const OUTFIT_STATUS: Record<string, number> = {
  ok: 200,
  bad_slot: 400,
  bad_name: 400,
  bad_look: 400,
  banned: 403,
  not_found: 404,
  no_look: 404,
  empty: 409,
};

export function outfitStatusFor(result: string): number {
  return OUTFIT_STATUS[result] ?? 500;
}
