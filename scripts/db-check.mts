/**
 * `npm run db:check` — prove the `DATABASE_URL` in the environment reaches
 * Supabase through the exact pool the site uses.
 *
 * It runs `select 1`, counts the two hiscores views, and then proves the shape
 * of the least-privilege role: refused on every table it must never read
 * (`account`, `login_attempt`, `session`, `account_login`), `EXECUTE` on the
 * eight `accounts.*` functions it needs and **not** on `throttled` or
 * `record_failure` — the rate limiter's own machinery, which a site that could
 * call it could reset. Those checks are the ones worth having: a URL that
 * connects as `postgres` looks identical to a correct one right up until
 * something reads a password hash.
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
  for (const table of [
    "public.account",
    "public.login_attempt",
    "public.session",
    "public.account_login",
  ]) {
    try {
      await query(`select 1 from ${table} limit 1`);
      console.error(
        `FAIL: this role can read ${table} — DATABASE_URL is not the \`website\` role.`,
      );
      process.exitCode = 1;
    } catch {
      console.log(`${table}: refused (expected)`);
    }
  }

  // The function grants, both directions. `throttled` and `record_failure` are
  // the rate limiter's own machinery: a site that could call them could reset
  // its own limit, so their absence is as load-bearing as the others' presence.
  const granted = [
    "accounts.password_salt(text)",
    "accounts.login(text, text, text)",
    "accounts.change_password(text, text, text, text)",
    "accounts.change_email(text, text, text, text, text)",
    "accounts.profile(text, text)",
    "accounts.recent_logins(text, text, int)",
    "accounts.register(text, text, text, text, text, text, text)",
    "accounts.reap()",
  ];
  const withheld = [
    "accounts.throttled(text, text)",
    "accounts.record_failure(text, text)",
  ];

  for (const [list, expected] of [
    [granted, true],
    [withheld, false],
  ] as const) {
    for (const signature of list) {
      const [{ allowed }] = await query<{ allowed: boolean }>(
        "select has_function_privilege(current_user, $1, 'EXECUTE') as allowed",
        [signature],
      );
      if (allowed === expected) {
        console.log(`${signature}: ${allowed ? "granted" : "withheld"} (expected)`);
      } else {
        console.error(
          `FAIL: ${signature} is ${allowed ? "granted" : "withheld"}; expected the opposite.`,
        );
        process.exitCode = 1;
      }
    }
  }

  // ...and the two reads answer emptily for a name nobody has, rather than
  // erroring. A `password_salt` that threw would make the login route's
  // fake-salt path unreachable and turn it back into a username oracle.
  const [{ salt }] = await query<{ salt: string | null }>(
    "select accounts.password_salt($1) as salt",
    ["__db_check__"],
  );
  if (salt === null) {
    console.log("accounts.password_salt('__db_check__'): null (expected)");
  } else {
    console.error("FAIL: password_salt returned a salt for a name nobody has.");
    process.exitCode = 1;
  }

  const rows = await query("select * from accounts.profile($1, $2)", [
    "__db_check__",
    "main",
  ]);
  if (rows.length === 0) {
    console.log("accounts.profile('__db_check__', 'main'): 0 rows (expected)");
  } else {
    console.error("FAIL: profile returned a row for a name nobody has.");
    process.exitCode = 1;
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
