/**
 * `npm run db:check` — prove the `DATABASE_URL` in the environment reaches
 * Supabase through the exact pool the site uses.
 *
 * It runs `select 1`, counts the two hiscores views, and then proves the shape
 * of the least-privilege role: refused on every table it must never read
 * (`account`, `login_attempt`, `session`, `account_login`, the Message
 * Centre's own five, the three transparency tables, migration 6's two invite
 * tables and migration 8's two record tables), `EXECUTE` on the fifty-two
 * `accounts.*` functions it needs
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
import {
  BANS_PAGE_SIZE,
  ECONOMY_DAYS,
  parseCensus,
  parseFlows,
  parseGroupRanges,
  parsePunishmentPage,
  parseSnapshots,
  parseStaffSpawnTotal,
  parseStaffSpawns,
  publicEconomyFlowStatement,
  publicEconomyGroupRangeStatement,
  publicEconomyLatestStatement,
  publicEconomyStatement,
  publicPunishmentsStatement,
  publicStaffSpawnTotalStatement,
  publicStaffSpawnsAllStatement,
  publicStaffSpawnsStatement,
  type Statement,
} from "../lib/public/queries.ts";
import { RECORD_DURATIONS } from "../lib/records/durations.ts";
import {
  parseRecordBoardRow,
  parseRecordCurrent,
  parseRecordDurationRow,
  recordBoardStatement,
  recordCurrentStatement,
  recordDurationsStatement,
} from "../lib/records/queries.ts";

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
    // 4_evidence_and_records' public four. These are the tables behind /bans
    // and /economy, and the site reads all of them — but only through the
    // `public_*` functions, which return the public columns and nothing else.
    // A direct grant here would hand the site `punishment.issued_by_account_id`,
    // which is the one column the whole feature exists to keep private.
    "public.punishment",
    "public.staff_spawn",
    "public.economy_snapshot",
    "public.economy_flow",
    // 6_invites. The invite tree is who-knows-whom for every player, and the
    // guess log is addresses; both are reached only through functions.
    "public.invite",
    "public.invite_attempt",
    // 8_records. The attempts are every player's XP at two instants and their
    // login times; the site reaches them only through the record functions,
    // which read the XP themselves so the site can never supply one.
    "public.record_attempt",
    "public.record_attempt_skill",
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
    // 4_evidence_and_records, public half. No actor argument anywhere: these
    // are the only functions in the API that answer the same thing to
    // everybody, because their answers are on public pages.
    "accounts.public_punishments(int, int)",
    "accounts.public_economy(int)",
    "accounts.public_economy_flow(int)",
    "accounts.public_staff_spawns(int)",
    // 7_staff_spawn_total. The windowed read above clamps to ninety days and
    // caps at five hundred rows, both silently, so it cannot answer "ever"
    // however large an argument it is passed. These two can, and the headline
    // on /economy is the sentence they exist for. Neither returns
    // `staff_account_id` or `target_account_id`, which is the trade the whole
    // feature rests on: the page names a number and never an account.
    "accounts.public_staff_spawn_total()",
    "accounts.public_staff_spawns_all()",
    // 5_economy_categories: the rest of the census. `public_economy_latest`
    // returns the `items` column the four above deliberately do not.
    "accounts.public_economy_latest()",
    "accounts.public_economy_group_range(int, jsonb)",
    // 6_invites: registration only through an invite, the player's own links,
    // and the staff view of who may invite.
    "accounts.invite_preview(text, text)",
    "accounts.register_with_invite(text, text, text, text, text, text, text, text)",
    "accounts.invite_create(text, text)",
    "accounts.invite_revoke(text, text)",
    "accounts.invites(text)",
    "accounts.citizen(text)",
    "accounts.staff_set_invites(text, text, text, boolean)",
    "accounts.staff_invite_tree(text, text)",
    "accounts.staff_inviters(text)",
    // 8_records: start, stop and cancel a record, the player's own reads, and
    // the public board. Every XP figure is read inside these functions.
    "accounts.record_durations()",
    "accounts.record_start(text, int)",
    "accounts.record_stop(text)",
    "accounts.record_abandon(text)",
    "accounts.record_current(text)",
    "accounts.record_history(text, int)",
    "accounts.record_attempt_skills(text, int)",
    "accounts.record_board(int, int, int)",
  ];
  const withheld = [
    "accounts.throttled(text, text)",
    "accounts.record_failure(text, text)",
    // The staff check itself. It is a helper the staff functions call while
    // running as the definer, not an API: a site that could call it would gain
    // nothing, but a site that could call it is a site somebody granted it to
    // by accident, and the whole point of these two lists is to notice that.
    "accounts.is_staff(text)",
    // The old open door. Still defined - migration 6's rollback grants it
    // back - but a website that can call it can make accounts without an
    // invite, which is the one thing migration 6 exists to stop.
    "accounts.register(text, text, text, text, text, text, text)",
    // 6_invites' helpers and its trigger function.
    "accounts.invite_maker_ok(int)",
    "accounts.invite_state(timestamptz, timestamptz, timestamptz, boolean)",
    "accounts.revoke_invites_on_ban()",
    // 8_records' helpers. `record_close_stale` writes; none of them is an API.
    "accounts.record_presence(int, timestamptz)",
    "accounts.record_stale(text, timestamptz, int)",
    "accounts.record_close_stale(int)",
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
  await checkPublicPages();
  await checkInvites();
  await checkRecords();
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

/**
 * One call per public function, built by the same statement builders the pages
 * use, and every row put through the same parser.
 *
 * The calls are read-only and take no actor, so there is nothing to refuse and
 * nothing to spend: what is being proved is that the four functions exist with
 * the argument types `lib/public/queries.ts` passes, and that their
 * `RETURNS TABLE` still matches what the parsers read. A column renamed in the
 * migration turns into rows the parser drops, which fails here rather than
 * turning /bans into a blank table in front of a player.
 *
 * Zero rows is a pass, not a failure. These tables are empty until the census
 * timer has run, and both pages are built to look finished that way.
 */
async function checkPublicPages(): Promise<void> {
  const reads: [
    string,
    Statement,
    (rows: readonly unknown[]) => readonly unknown[],
  ][] = [
    [
      "public_punishments",
      publicPunishmentsStatement(1),
      (rows) => [...parsePunishmentPage(rows, 1).items],
    ],
    ["public_economy", publicEconomyStatement(), (rows) => parseSnapshots(rows)],
    [
      "public_economy_flow",
      publicEconomyFlowStatement(),
      (rows) => parseFlows(rows),
    ],
    [
      "public_staff_spawns",
      publicStaffSpawnsStatement(),
      (rows) => parseStaffSpawns(rows),
    ],
    [
      "public_staff_spawns_all",
      publicStaffSpawnsAllStatement(),
      (rows) => parseStaffSpawns(rows),
    ],
    [
      "public_economy_latest",
      publicEconomyLatestStatement(),
      // One row or none, and `parseCensus` answers with one object or `null`.
      // Wrapped in an array so it is counted like every other read here.
      (rows) => (parseCensus(rows) === null ? [] : [parseCensus(rows)]),
    ],
    [
      "public_economy_group_range",
      // A map of two groups rather than the real eleven from
      // `lib/items/groups.ts`. What this script proves is the signature and the
      // RETURNS TABLE, and importing the taxonomy would drag 3,883 rows of
      // JSON through Node's type-stripping loader for no extra assurance. The
      // groups themselves are checked by `lib/items/groups.test.ts`.
      publicEconomyGroupRangeStatement(ECONOMY_DAYS, {
        ores: [440, 453],
        rares: [1038],
      }),
      (rows) => [...parseGroupRanges(rows)],
    ],
  ];

  for (const [name, statement, parse] of reads) {
    const rows = await query(statement.text, statement.values);
    // `public_punishments` deliberately asks for one row more than a page
    // shows, so its parser returning fewer is the page size, not a drop.
    const parsed = parse(rows);
    const kept =
      name === "public_punishments"
        ? Math.min(rows.length, BANS_PAGE_SIZE)
        : rows.length;

    if (parsed.length === kept) {
      console.log(`accounts.${name}(…): ${rows.length} rows, all readable`);
    } else {
      console.error(
        `FAIL: ${name} returned ${rows.length} rows and the parser could read ${parsed.length}; the RETURNS TABLE has drifted.`,
      );
      process.exitCode = 1;
    }
  }

  // `public_staff_spawn_total` gets its own check rather than a row in the
  // table above, because the property worth proving is one the row-count
  // comparison cannot see: it must return **exactly one row** on an empty
  // table, not none.
  //
  // That is the contract the /economy headline is built on. A row of zeroes
  // means nobody has ever conjured an item into the economy; no row at all
  // means the read failed. They look identical by the time they reach a page
  // and they are opposite claims, so the page prints the first as "0 items
  // ever created by staff" and the second as an error. If this function ever
  // became `RETURNS SETOF` over the table, or grew a `WHERE` that filtered the
  // aggregate away, the page would start printing a nought it had not read —
  // and that is the single worst failure this site has, because it is the one
  // that lies quietly.
  const total = await query(publicStaffSpawnTotalStatement().text);
  if (total.length !== 1) {
    console.error(
      `FAIL: public_staff_spawn_total returned ${total.length} rows; it must always return exactly one, even over an empty table.`,
    );
    process.exitCode = 1;
  } else if (parseStaffSpawnTotal(total) === null) {
    console.error(
      "FAIL: public_staff_spawn_total returned a row the parser could not read; the RETURNS TABLE has drifted.",
    );
    process.exitCode = 1;
  } else {
    console.log("accounts.public_staff_spawn_total(): 1 row, readable (expected)");
  }
}

/**
 * One call per migration 6 function that can be called without writing.
 *
 * `invite_preview` is left out on purpose: a code nobody has is recorded as a
 * guess against the caller's address, and this script promises to write
 * nothing. Its grant is still checked above. `register_with_invite` is called
 * with a password hash that is not bcrypt, which it refuses before reading or
 * writing anything - that proves the grant and the argument list and nothing
 * more.
 */
async function checkInvites(): Promise<void> {
  const empty: [string, string, readonly unknown[]][] = [
    ["invites", "select * from accounts.invites($1)", ["__db_check__"]],
    ["citizen", "select * from accounts.citizen($1)", ["__db_check__"]],
    ["staff_invite_tree", "select * from accounts.staff_invite_tree($1, $2)", ["__db_check__", "__db_check__"]],
    ["staff_inviters", "select * from accounts.staff_inviters($1)", ["__db_check__"]],
  ];
  for (const [name, text, values] of empty) {
    const rows = await query(text, values);
    if (rows.length === 0) {
      console.log(`accounts.${name}('__db_check__'): 0 rows (expected)`);
    } else {
      console.error(`FAIL: ${name} returned ${rows.length} rows for a name nobody has.`);
      process.exitCode = 1;
    }
  }

  const answers: [string, string, readonly unknown[], string][] = [
    ["invite_create", "select result from accounts.invite_create($1, $2)", ["__db_check__", "not a code"], "invalid"],
    ["invite_revoke", "select accounts.invite_revoke($1, $2) as result", ["__db_check__", "not a code"], "not_found"],
    ["staff_set_invites", "select accounts.staff_set_invites($1, $2, $3, $4) as result", ["__db_check__", "", "__db_check__", true], "forbidden"],
  ];
  for (const [name, text, values, expected] of answers) {
    const [row] = await query<{ result: unknown }>(text, values);
    if (row?.result === expected) {
      console.log(`accounts.${name}: ${expected} (expected)`);
    } else {
      console.error(`FAIL: ${name} answered ${JSON.stringify(row?.result)}; expected ${expected}.`);
      process.exitCode = 1;
    }
  }

  try {
    await query(
      "select * from accounts.register_with_invite($1, $2, $3, $4, $5, $6, $7, $8)",
      ["0000000000000000", "__db_check__", "", "", "not bcrypt", "", "", ""],
    );
    console.error("FAIL: register_with_invite accepted a hash that is not bcrypt.");
    process.exitCode = 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("register_with_invite: p_password_hash is not a bcrypt hash")) {
      console.log("accounts.register_with_invite: refuses a non-bcrypt hash (expected)");
    } else {
      console.error(`FAIL: register_with_invite threw something else: ${message}`);
      process.exitCode = 1;
    }
  }
}

/**
 * Migration 8, against `__db_check__`.
 *
 * **Nothing here writes a row.** `record_start`, `record_stop` and
 * `record_abandon` resolve the username before they do anything else and
 * answer `not_found` when there is no such account, so this is safe against
 * production.
 *
 * `record_current` gets its own check, as `public_staff_spawn_total` does: it
 * must answer a name nobody has with exactly one row, because the account page
 * polls it and "no rows" would read as "the read failed" there. It goes
 * through the page's own parser, which throws on anything but one row.
 *
 * And the durations are a cross-repo contract: the database decides which
 * record lengths exist and `lib/records/durations.ts` names them, so the two
 * lists must match exactly, grace included.
 */
async function checkRecords(): Promise<void> {
  const currentStatement = recordCurrentStatement("__db_check__");
  const currentRows = await query(currentStatement.text, currentStatement.values);
  try {
    const current = parseRecordCurrent(currentRows);
    if (current.presence === "never" && current.attempt === null) {
      console.log("accounts.record_current('__db_check__'): one row, never, no attempt (expected)");
    } else {
      console.error(`FAIL: record_current for a name nobody has answered ${JSON.stringify(current)}.`);
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(
      `FAIL: record_current returned ${currentRows.length} rows for a name nobody has; it must always return exactly one. ` +
        `The account page polls this, and "no rows" and "the read failed" are different sentences there. ` +
        (error instanceof Error ? error.message : String(error)),
    );
    process.exitCode = 1;
  }

  const writes: [string, string, readonly unknown[]][] = [
    ["record_start", "select result from accounts.record_start($1, $2)", ["__db_check__", RECORD_DURATIONS[0].seconds]],
    ["record_stop", "select result from accounts.record_stop($1)", ["__db_check__"]],
    ["record_abandon", "select accounts.record_abandon($1) as result", ["__db_check__"]],
  ];
  for (const [name, text, values] of writes) {
    const [row] = await query<{ result: unknown }>(text, values);
    if (row?.result === "not_found") {
      console.log(`accounts.${name}('__db_check__'): not_found (expected)`);
    } else {
      console.error(`FAIL: ${name} answered ${JSON.stringify(row?.result)}; expected not_found.`);
      process.exitCode = 1;
    }
  }

  const empty: [string, string, readonly unknown[]][] = [
    ["record_history", "select * from accounts.record_history($1, $2)", ["__db_check__", 20]],
    ["record_attempt_skills", "select * from accounts.record_attempt_skills($1, $2)", ["__db_check__", 1]],
  ];
  for (const [name, text, values] of empty) {
    const rows = await query(text, values);
    if (rows.length === 0) {
      console.log(`accounts.${name}('__db_check__', …): 0 rows (expected)`);
    } else {
      console.error(`FAIL: ${name} returned ${rows.length} rows for a name nobody has.`);
      process.exitCode = 1;
    }
  }

  // The public board through the page's parser. Zero rows is a pass - it is
  // the normal state until somebody sets a record.
  const board = recordBoardStatement(RECORD_DURATIONS[0].seconds, 0);
  const boardRows = (await query(board.text, board.values)).map(parseRecordBoardRow);
  console.log(`accounts.record_board(${RECORD_DURATIONS[0].seconds}, 0, …): ${boardRows.length} rows, parsed`);

  const durations = recordDurationsStatement();
  const inSql = (await query(durations.text, durations.values))
    .map(parseRecordDurationRow)
    .map((row) => `${row.seconds}:${row.graceSeconds}`)
    .sort();
  const onSite = RECORD_DURATIONS.map((row) => `${row.seconds}:${row.graceSeconds}`).sort();
  if (JSON.stringify(inSql) === JSON.stringify(onSite)) {
    console.log(`accounts.record_durations(): ${inSql.join(", ")} - matches lib/records/durations.ts (expected)`);
  } else {
    console.error(
      `FAIL: accounts.record_durations() is [${inSql.join(", ")}] but lib/records/durations.ts is [${onSite.join(", ")}].`,
    );
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
