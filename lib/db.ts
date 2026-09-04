import "server-only";

import { Pool, type QueryResultRow } from "pg";

/**
 * The one Postgres pool for the whole site: hiscores reads and the
 * registration function both go through it.
 *
 * Two constraints come from Supabase's shared *transaction* pooler on :6543,
 * which is what `DATABASE_URL` must point at:
 *
 * - **No named prepared statements.** Transaction mode hands a different
 *   backend to each transaction, so a statement prepared on one connection is
 *   not there on the next. `node-postgres` only prepares when a query carries
 *   a `name`, so every query in this repo passes `{ text, values }` and never
 *   `{ name }`. `query()` below is the only entry point, which keeps that
 *   true by construction.
 * - **A small pool.** Serverless scales out to many instances, each with its
 *   own pool, so `max` is per-instance. 2 is enough for one request and cheap
 *   to leave idle.
 *
 * `import "server-only"` makes a stray client-side import a build error rather
 * than a bundled connection string.
 */

const POOL_MAX = 2;
/** Supabase is in the same region; a query that takes longer is stuck. */
const STATEMENT_TIMEOUT_MS = 10_000;
const CONNECTION_TIMEOUT_MS = 10_000;
/** Vercel freezes idle instances; a long-idle socket is usually already dead. */
const IDLE_TIMEOUT_MS = 30_000;

declare global {
  // Dev hot-reloads re-evaluate modules; without this each reload would leak a
  // pool. `var` is what `globalThis` augmentation needs.
  var __zanarisPgPool: Pool | undefined;
}

function create(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  return new Pool({
    connectionString,
    max: POOL_MAX,
    statement_timeout: STATEMENT_TIMEOUT_MS,
    connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
    idleTimeoutMillis: IDLE_TIMEOUT_MS,
    // Supabase's pooler presents a certificate for *.pooler.supabase.com that
    // chains to a root Node does not ship. The connection is still TLS; the
    // chain is not verified. Same trade-off the hub's login server makes.
    ssl: { rejectUnauthorized: false },
  });
}

/** The lazily-created shared pool. */
export function pool(): Pool {
  globalThis.__zanarisPgPool ??= create();
  return globalThis.__zanarisPgPool;
}

/** Is a database configured at all? Routes answer 503 rather than throwing. */
export function isConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

/**
 * Run one parameterised query. Deliberately the only way to reach the pool:
 * it takes `text` and `values` and no `name`, so nothing in the codebase can
 * accidentally ask for a named prepared statement.
 */
export async function query<T extends QueryResultRow>(
  text: string,
  values: readonly unknown[] = [],
): Promise<T[]> {
  const result = await pool().query<T>(text, values as unknown[]);
  return result.rows;
}
