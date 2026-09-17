import "server-only";

import { Pool, type QueryResultRow } from "pg";

import { registerInt8AsNumber } from "./pg-int8.ts";
import { SUPABASE_ROOT_CA } from "./supabase-ca.ts";

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
 *
 * An `int8` type parser **is** registered, like the engine's pool. The casts in
 * `lib/hiscores/queries.ts` cover `row_number()` and `count(*)`, but
 * `hiscore_large.value` is a `BIGINT` selected raw, and pg's default for `int8`
 * is a string — see `lib/pg-int8.ts` for why `Number` is safe for this column.
 */

const POOL_MAX = 2;
/**
 * Supabase is in the same region; a query that takes longer is stuck.
 *
 * `query_timeout`, not `statement_timeout`: the latter is a *server* GUC that
 * `pg` sends in the StartupMessage, and a transaction-mode pooler may reject
 * the connection outright for sending one. This is enforced client-side, which
 * the pooler cannot object to.
 */
const QUERY_TIMEOUT_MS = 10_000;
const CONNECTION_TIMEOUT_MS = 10_000;
/** Vercel freezes idle instances; a long-idle socket is usually already dead. */
const IDLE_TIMEOUT_MS = 30_000;

declare global {
  // Dev hot-reloads re-evaluate modules; without this each reload would leak a
  // pool. `var` is what `globalThis` augmentation needs.
  var __zanarisPgPool: Pool | undefined;
}

function create(): Pool {
  // Process-global inside `pg`, so it happens once, here, before any pool
  // exists and therefore before any row is parsed.
  registerInt8AsNumber();

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  // TLS has to be configured here and not in the URL: `pg` only enables it
  // when `ssl` is set or the URL carries `sslmode`, and a URL parameter
  // overrides this object. The plan's `DATABASE_URL` has no `sslmode`, so
  // without this the password would cross the internet in the clear.
  //
  // The chain is **always** verified. `rejectUnauthorized: false` is never an
  // option here: this credential can call `accounts.register_with_invite`,
  // and the `postgres` role reachable at the same host with the same password
  // can read every password hash, so an unauthenticated TLS session is not
  // good enough.
  //
  // Verified 2026-09-04: `aws-0-us-east-1.pooler.supabase.com:6543` presents
  // `CN=*.pooler.supabase.com` under a self-signed "Supabase Root 2021 CA"
  // that no public trust store carries, so the CA has to be shipped with the
  // app — `lib/supabase-ca.ts`, which validates that live chain as its sole
  // trust root. `DATABASE_SSL_CA` overrides it, for a rotation that lands
  // before a deploy can.
  const ca = process.env.DATABASE_SSL_CA || SUPABASE_ROOT_CA;

  const pool = new Pool({
    connectionString,
    max: POOL_MAX,
    query_timeout: QUERY_TIMEOUT_MS,
    connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
    idleTimeoutMillis: IDLE_TIMEOUT_MS,
    ssl: { rejectUnauthorized: true, ca },
  });

  // A pooler dropping an idle client emits `error` on the pool, and an
  // unhandled `error` event takes the whole process down — here, the serverless
  // instance, mid-request for whoever else it was serving.
  pool.on("error", (error) => {
    console.error("[db] idle client error", error);
  });

  return pool;
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
