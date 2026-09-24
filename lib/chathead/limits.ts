/**
 * The outfit limits, apart from `validate.ts` so that code running outside
 * Next (`scripts/db-check.mts`, under node's type stripping) can read them
 * without importing the JSON tables. The database has the same numbers
 * (migration 12's CHECKs).
 */
export const OUTFIT_SLOTS = 10;
export const OUTFIT_NAME_MAX = 32;
