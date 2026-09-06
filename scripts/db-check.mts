/**
 * `npm run db:check` — prove the `DATABASE_URL` in the environment reaches
 * Supabase through the exact pool the site uses.
 *
 * It runs `select 1`, counts the two hiscores views, and then proves the shape
 * of the least-privilege role: refused on every table it must never read
 * (`account`, `login_attempt`, `session`, `account_login`, and the Message
 * Centre's own five), `EXECUTE` on the twenty `accounts.*` functions it needs
 * and **not** on `throttled`, `record_failure` or `is_staff` — the rate
 * limiter's own machinery and the staff check, none of which is an API. Those
 * checks are the ones worth having: a URL that connects as `postgres` looks
 * identical to a correct one right up until something reads a password hash.
 *
 * It then calls every function once against a username nobody has. None of
 * them writes a row — see `checkMessageCentre` — and a `RETURNS TABLE` shape
 * that had drifted from what `lib/` builds fails here rather than on a page.
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
  //
  // The table name is interpolated rather than parameterised because a table
  // name cannot be a placeholder in SQL. It is safe here and only here: the
  // list below is a hardcoded constant in this file, with nothing from the
  // environment, the arguments or the database anywhere near it.
  for (const table of [
    "public.account",
    "public.login_attempt",
    "public.session",
    "public.account_login",
    // 3_message_centre's four tables plus `report`, on the same terms: RLS on
    // with no policies, and no grant to `website`. Everything the site can do
    // with a message, a ticket or a report goes through a SECURITY DEFINER
    // function that keys off the username in the signed cookie.
    "public.account_message",
    "public.ticket",
    "public.ticket_message",
    "public.staff_action",
    "public.report",
    // 4_evidence_and_records. The evidence tables are the most sensitive rows
    // on the fleet - one is a recording of a player's mouse and one is their
    // private messages - and `session_wealth`, `public_chat` and `private_chat`
    // have been unreadable since 0_init and must stay that way now that
    // functions read them on the site's behalf.
    "public.report_input",
    "public.report_chat",
    "public.session_wealth",
    "public.public_chat",
    "public.private_chat",
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
    // 3_message_centre.
    "accounts.unread(text)",
    "accounts.messages(text)",
    "accounts.message(text, int)",
    "accounts.tickets(text)",
    "accounts.ticket_thread(text, int)",
    "accounts.ticket_open(text, text, text, text)",
    "accounts.ticket_reply(text, int, text)",
    "accounts.staff_inbox(text, text)",
    "accounts.staff_thread(text, int)",
    "accounts.staff_reply(text, int, text, boolean)",
    "accounts.staff_notice(text, text, text, text, text)",
    "accounts.staff_reports(text, timestamptz)",
    // 4_evidence_and_records.
    "accounts.staff_report(text, int)",
    "accounts.staff_report_input(text, int)",
    "accounts.staff_report_chat(text, int)",
    "accounts.staff_report_wealth(text, int)",
    "accounts.staff_wealth(text, text, timestamptz)",
    "accounts.staff_report_resolve(text, text, int, text, text)",
    "accounts.staff_lift(text, text, int, text)",
    "accounts.staff_punishment_note(text, int, text)",
  ];
  const withheld = [
    "accounts.throttled(text, text)",
    "accounts.record_failure(text, text)",
    // The staff check itself. It is a helper the staff functions call while
    // running as the definer, not an API: a site that could call it would gain
    // nothing, but a site that could call it is a site somebody granted it to
    // by accident, and the whole point of these two lists is to notice that.
    "accounts.is_staff(text)",
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

  // The account centre's other read. Nothing here inspects the columns — the
  // point is the shape: `recent_logins` is the one function whose signature
  // takes three arguments, and a limit that had become `smallint`, or a
  // `RETURNS TABLE` that had lost a column, would fail here rather than on the
  // page. Ten is what `lib/account/profile.ts` asks for.
  const logins = await query(
    "select * from accounts.recent_logins($1, $2, $3)",
    ["__db_check__", "main", 10],
  );
  if (logins.length === 0) {
    console.log(
      "accounts.recent_logins('__db_check__', 'main', 10): 0 rows (expected)",
    );
  } else {
    console.error(
      `FAIL: recent_logins returned ${logins.length} rows for a name nobody has.`,
    );
    process.exitCode = 1;
  }

  await checkMessageCentre();
  await checkEvidence();
}

/**
 * One call per function in `4_evidence_and_records`, all of them against
 * `__db_check__`.
 *
 * **Nothing here writes a row**, and again that is a property of the functions
 * rather than of this script: all three writes check `accounts.is_staff` first
 * and return `forbidden` before they look at the candidate hash, the report id
 * or the punishment id — and before any of them reaches a rate-limit bucket,
 * so running this does not spend a moderator's twenty notes an hour either.
 * In particular `staff_report_resolve` cannot delete evidence from here, which
 * is the one call in this file that could do real damage if it did anything
 * at all.
 *
 * The reads exist for the `RETURNS TABLE` shapes. `lib/staff/queries.ts` reads
 * `data_base64`, `same_ip_as_reporter`, `counterpart_items` and a dozen other
 * column names by hand, and a column renamed in a later migration would show up
 * as an empty page rather than as an error - unless it fails here first.
 */
async function checkEvidence(): Promise<void> {
  const reads: [string, string, readonly unknown[]][] = [
    ["staff_report", "select * from accounts.staff_report($1, $2)", ["__db_check__", 1]],
    [
      "staff_report_input",
      "select * from accounts.staff_report_input($1, $2)",
      ["__db_check__", 1],
    ],
    [
      "staff_report_chat",
      "select * from accounts.staff_report_chat($1, $2)",
      ["__db_check__", 1],
    ],
    [
      "staff_report_wealth",
      "select * from accounts.staff_report_wealth($1, $2)",
      ["__db_check__", 1],
    ],
    [
      "staff_wealth",
      "select * from accounts.staff_wealth($1, $2, $3)",
      ["__db_check__", "__db_check__", null],
    ],
  ];

  for (const [name, text, values] of reads) {
    const rows = await query(text, values);
    if (rows.length === 0) {
      console.log(`accounts.${name}('__db_check__', …): 0 rows (expected)`);
    } else {
      console.error(
        `FAIL: ${name} returned ${rows.length} rows for a name nobody has.`,
      );
      process.exitCode = 1;
    }
  }

  // A 60-character string in the hash slot: the functions check `is_staff`
  // before they look at the hash at all, so it is never compared, but passing
  // something shaped wrong would prove less.
  const hash = `$2b$10$${"x".repeat(53)}`;

  const writes: [string, string, readonly unknown[], string][] = [
    [
      "staff_report_resolve",
      "select accounts.staff_report_resolve($1, $2, $3, $4, $5) as result",
      ["__db_check__", hash, 1, "watch", "db:check"],
      "forbidden",
    ],
    [
      "staff_lift",
      "select accounts.staff_lift($1, $2, $3, $4) as result",
      ["__db_check__", hash, 1, "db:check"],
      "forbidden",
    ],
    [
      "staff_punishment_note",
      "select accounts.staff_punishment_note($1, $2, $3) as result",
      ["__db_check__", 1, "db:check"],
      "forbidden",
    ],
  ];

  for (const [name, text, values, expected] of writes) {
    const [row] = await query<{ result: string }>(text, values);
    if (row?.result === expected) {
      console.log(`accounts.${name}('__db_check__', …): ${expected} (expected)`);
    } else {
      console.error(
        `FAIL: ${name} answered ${JSON.stringify(row?.result)}; expected ${expected}.`,
      );
      process.exitCode = 1;
    }
  }
}

/**
 * One call per function in `3_message_centre`, all of them against
 * `__db_check__` — a username nobody has.
 *
 * **Nothing here writes a row**, including the four functions whose job is to
 * write, and that is a property of the functions rather than of this script:
 * `ticket_open` and `ticket_reply` resolve the username to an account id
 * before they do anything else and return `invalid`/`not_found` when there
 * isn't one, and `staff_reply` and `staff_notice` check `accounts.is_staff`
 * first and return `forbidden`. `staff_notice` in particular returns before it
 * reaches `record_failure`, so this does not spend a rate-limit token either.
 *
 * The value of running them at all is that a `RETURNS TABLE` shape or an
 * argument type that drifted from what `lib/` builds would fail *here*, on a
 * script anybody can run, rather than on a page in front of a player.
 */
async function checkMessageCentre(): Promise<void> {
  const [{ unread }] = await query<{ unread: number }>(
    "select accounts.unread($1) as unread",
    ["__db_check__"],
  );
  if (unread === 0) {
    console.log("accounts.unread('__db_check__'): 0 (expected)");
  } else {
    console.error(`FAIL: unread returned ${unread} for a name nobody has.`);
    process.exitCode = 1;
  }

  // The reads. Each must answer with no rows rather than erroring: a name
  // nobody has is not an error anywhere in this API.
  const reads: [string, string, readonly unknown[]][] = [
    ["messages", "select * from accounts.messages($1)", ["__db_check__"]],
    ["message", "select * from accounts.message($1, $2)", ["__db_check__", 1]],
    ["tickets", "select * from accounts.tickets($1)", ["__db_check__"]],
    [
      "ticket_thread",
      "select * from accounts.ticket_thread($1, $2)",
      ["__db_check__", 1],
    ],
    [
      "staff_inbox",
      "select * from accounts.staff_inbox($1, $2)",
      ["__db_check__", "open"],
    ],
    [
      "staff_thread",
      "select * from accounts.staff_thread($1, $2)",
      ["__db_check__", 1],
    ],
    [
      "staff_reports",
      "select * from accounts.staff_reports($1, $2)",
      ["__db_check__", null],
    ],
  ];

  for (const [name, text, values] of reads) {
    const rows = await query(text, values);
    if (rows.length === 0) {
      console.log(`accounts.${name}('__db_check__', …): 0 rows (expected)`);
    } else {
      console.error(
        `FAIL: ${name} returned ${rows.length} rows for a name nobody has.`,
      );
      process.exitCode = 1;
    }
  }

  // The writes, each refused before it writes anything, and each refused for
  // its own reason.
  const writes: [string, string, readonly unknown[], string][] = [
    [
      "ticket_open",
      "select accounts.ticket_open($1, $2, $3, $4) as result",
      ["__db_check__", "bug", "db:check", "db:check"],
      "invalid",
    ],
    [
      "ticket_reply",
      "select accounts.ticket_reply($1, $2, $3) as result",
      ["__db_check__", 1, "db:check"],
      "not_found",
    ],
    [
      "staff_reply",
      "select accounts.staff_reply($1, $2, $3, $4) as result",
      ["__db_check__", 1, "db:check", false],
      "forbidden",
    ],
    [
      "staff_notice",
      "select accounts.staff_notice($1, $2, $3, $4, $5) as result",
      // A 60-character string in the hash slot: the function checks
      // `is_staff` before it looks at the hash at all, so this never gets
      // compared, but passing something shaped wrong would prove less.
      ["__db_check__", `$2b$10$${"x".repeat(53)}`, "__db_check__", "s", "b"],
      "forbidden",
    ],
  ];

  for (const [name, text, values, expected] of writes) {
    const [row] = await query<{ result: string }>(text, values);
    if (row?.result === expected) {
      console.log(`accounts.${name}('__db_check__', …): ${expected} (expected)`);
    } else {
      console.error(
        `FAIL: ${name} answered ${JSON.stringify(row?.result)}; expected ${expected}.`,
      );
      process.exitCode = 1;
    }
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
