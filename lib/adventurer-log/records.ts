import type { Statement } from "@/lib/account/register";
import { xpFromValue } from "@/lib/hiscores/format";

/**
 * Migration 015's `accounts.adventure_log_records`: one row per record
 * duration the player has a place on the Overall board, shortest first,
 * valid attempts only - the same rows `/hiscores/records` ranks, just this
 * player's best of each. The same discipline as `lib/adventurer-log/queries.ts`:
 * the statement is `{ text, values }` with nothing interpolated, and a row
 * nobody documented throws instead of being guessed at.
 *
 * `gained` arrives raw, the engine's x10 scale, like every XP figure in this
 * database - `lib/records/queries.ts` leaves the division to its callers, but
 * this module has exactly one caller (`components/adventurer-log/Records.tsx`),
 * so it divides here: `LogRecord.gained` is XP as a player reads it.
 */

function asRecord(row: unknown, where: string): Record<string, unknown> {
  if (typeof row !== "object" || row === null) throw new Error(`${where}: not a row`);
  return row as Record<string, unknown>;
}

function asIso(value: unknown, where: string): string {
  const date =
    value instanceof Date ? value : typeof value === "string" ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) {
    throw new Error(`${where}: not a time: ${JSON.stringify(value)}`);
  }
  return date.toISOString();
}

function asInt(value: unknown, where: string): number {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  throw new Error(`${where}: not a whole number: ${JSON.stringify(value)}`);
}

export type LogRecord = {
  readonly durationSeconds: number;
  /** XP as a player reads it, already divided by ten. */
  readonly gained: number;
  readonly elapsedMs: number;
  readonly achievedAt: string;
  /** Exactly the rank this gain holds on `/hiscores/records`' Overall board. */
  readonly rank: number;
};

export function recordsStatement(name: string): Statement {
  return { text: "select * from accounts.adventure_log_records($1)", values: [name] };
}

export function parseRecords(rows: readonly unknown[]): LogRecord[] {
  return rows.map((raw) => {
    const row = asRecord(raw, "adventure_log_records");
    return {
      durationSeconds: asInt(row.duration_seconds, "adventure_log_records duration_seconds"),
      gained: xpFromValue(asInt(row.gained, "adventure_log_records gained")),
      elapsedMs: asInt(row.elapsed_ms, "adventure_log_records elapsed_ms"),
      achievedAt: asIso(row.achieved_at, "adventure_log_records achieved_at"),
      rank: asInt(row.rank, "adventure_log_records rank"),
    };
  });
}
