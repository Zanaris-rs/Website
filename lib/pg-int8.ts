import { types } from "pg";

/**
 * Teach `pg` that `bigint` is a number here.
 *
 * Postgres `int8` (OID 20) holds more than a JavaScript number can, so
 * `node-postgres` hands it back as a **string** by default rather than lose
 * precision silently. That is the right default and the wrong one for this
 * site: `hiscores.hiscore_large_public.value` is `BIGINT`, and
 * `lib/hiscores/queries.ts` selects it raw — only `row_number()` and
 * `count(*)` are cast to `int`. So `TableRow.value` and `PlayerRow.value` are
 * typed `number` and were arriving as `"41171000"`.
 *
 * Nothing had broken yet: the one consumer is `xpFromValue`, whose `value / 10`
 * coerces the string back to a number. But the types were lying, and the first
 * `+`, `Math.max`, `toLocaleString` or comparator to touch that field would
 * have concatenated, ranked lexicographically, or thrown — the sort of bug
 * that ships and then shows up as a wrong number on a page nobody diffed.
 *
 * `Number` is safe for the values this column actually holds: `value` is XP
 * times ten, and the engine caps XP at 200 million, so the ceiling is 2e9 —
 * three orders of magnitude below `Number.MAX_SAFE_INTEGER`. Anything genuinely
 * beyond 2^53 would round, which is why this is registered here, deliberately,
 * for this schema, rather than being pg's default for everyone.
 *
 * This is process-global inside `pg`, so it is done once, from `lib/db.ts`,
 * before the pool exists. It lives in its own module — free of
 * `import "server-only"` — so it can be unit tested; importing `lib/db.ts`
 * from a test would throw on that marker.
 */
export const INT8_OID = 20;

export function registerInt8AsNumber(): void {
  types.setTypeParser(INT8_OID, Number);
}
