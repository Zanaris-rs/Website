/**
 * `npm run db:check` — prove the `DATABASE_URL` in the environment reaches
 * Supabase through the exact pool the site uses.
 *
 * It runs `select 1`, then counts the two hiscores views and confirms that the
 * `website` role is *refused* on `public.account`. That last check is the one
 * worth having: a URL that connects as `postgres` looks identical to a correct
 * one until something reads a password hash.
 *
 * Run with the repo's script wrapper, not bare `node`:
 *
 *   npm run db:check
 *
 * (`--conditions=react-server` is what lets `lib/db.ts`'s `server-only` guard
 * resolve outside Next.)
 */

import { readFileSync } from "node:fs";

import { isConfigured, pool, query } from "../lib/db.ts";

/** Minimal `.env.local` reader: this script runs outside Next's loader. */
function loadEnvLocal(): void {
  let text: string;
  try {
    text = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  } catch {
    return;
  }

  for (const line of text.split("\n")) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = rawValue.trim().replace(/^["']|["']$/g, "");
  }
}

async function main(): Promise<void> {
  loadEnvLocal();

  if (!isConfigured()) {
    console.error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.",
    );
    process.exitCode = 1;
    return;
  }

  const [{ one }] = await query<{ one: number }>("select 1 as one");
  console.log(`select 1 -> ${one}`);

  const [{ role }] = await query<{ role: string }>(
    "select current_user as role",
  );
  console.log(`connected as ${role}`);

  for (const view of ["hiscore_public", "hiscore_large_public"]) {
    const [{ count }] = await query<{ count: string }>(
      `select count(*)::text as count from hiscores.${view}`,
    );
    console.log(`hiscores.${view}: ${count} rows`);
  }

  // The `website` role must NOT be able to read the account table. A URL that
  // still names the `postgres` role passes every check above and fails here.
  try {
    await query("select 1 from public.account limit 1");
    console.error(
      "FAIL: this role can read public.account — DATABASE_URL is not the `website` role.",
    );
    process.exitCode = 1;
  } catch {
    console.log("public.account: refused (expected)");
  }
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  if (isConfigured()) await pool().end();
}
