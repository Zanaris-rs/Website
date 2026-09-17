import { WINDOW_ROWS } from "./format";
import type { PlayerParams, TableParams } from "./params";

/**
 * The SQL behind the hiscores routes.
 *
 * Pure string building, so `queries.test.ts` can assert the exact text and
 * parameters without a database. Two rules hold everywhere in this file:
 *
 * - **Every value is a placeholder.** The only thing interpolated is the view
 *   name, chosen from the two constants below by category, never from input.
 * - **No statement names.** `lib/db.ts` refuses to pass one; Supabase's
 *   transaction pooler cannot keep a prepared statement between queries.
 *
 * Both views already exclude staff above `staffmodlevel > 1` and accounts
 * under a live ban, so nothing here filters for visibility.
 */

export type Statement = {
  readonly text: string;
  readonly values: readonly unknown[];
};

/** Overall lives in its own table; `type` there is always 0. */
const OVERALL_VIEW = "hiscores.hiscore_large_public";
const SKILL_VIEW = "hiscores.hiscore_public";

/**
 * Rank order: highest level first, then highest value, then whoever got there
 * first, then the lower account id. `value` is XP times ten. A skill's level is
 * monotonic in its XP, so the leading key only changes Overall, where level is
 * total level: a higher total level outranks more total XP.
 */
const RANK_ORDER = "level desc, value desc, date asc, account_id asc";

/** Which view and `type` a category reads. */
export function sourceFor(category: number): {
  view: string;
  type: number;
} {
  return category === 0
    ? { view: OVERALL_VIEW, type: 0 }
    : { view: SKILL_VIEW, type: category };
}

export type TableRow = {
  rank: number;
  username: string;
  level: number;
  value: number;
};

/**
 * One window of the table. `row_number()` over the whole category is what
 * gives a rank; the CTE is shared by both selections so a name lookup resolves
 * its rank and its window in a single round trip.
 */
export function tableQuery(params: TableParams): Statement {
  const { view, type } = sourceFor(params.category);
  const ranked = `
    with ranked as (
      select
        account_id,
        username,
        level,
        value,
        (row_number() over (order by ${RANK_ORDER}))::int as rank
      from ${view}
      where profile = $1 and type = $2
    )`;

  const selection = params.selection;

  if (selection.kind === "name") {
    return {
      text: `${ranked},
    found as (
      select rank from ranked where username = $3
    )
    select r.rank, r.username, r.level, r.value
    from ranked r
    join found f
      on r.rank between greatest(1, f.rank - ${WINDOW_ROWS - 1})
                    and greatest(${WINDOW_ROWS}, f.rank)
    order by r.rank`,
      values: [params.profile, type, selection.username],
    };
  }

  // "top" is just the window around rank 1.
  const end =
    selection.kind === "rank"
      ? Math.max(WINDOW_ROWS, selection.rank)
      : WINDOW_ROWS;
  const start = Math.max(1, end - (WINDOW_ROWS - 1));

  return {
    text: `${ranked}
    select rank, username, level, value
    from ranked
    where rank between $3 and $4
    order by rank`,
    values: [params.profile, type, start, end],
  };
}

export type PlayerRow = {
  category: number;
  username: string;
  account_id: number; // `account.id`, shown publicly as the citizen number
  level: number;
  value: number;
  rank: number;
};

/**
 * A correlated `count(*) + 1` for one row's rank, in `RANK_ORDER`. Cheaper
 * than ranking the whole category twenty times. A skill leaves out the level
 * key, which its XP already decides, so its leading `value > ` comparison is
 * served by the `(profile, type, value desc)` index and the tie-breaks only
 * ever look at rows on the same value. Overall compares total level first.
 */
function rankOf(view: string): string {
  const aheadOnValue = `o.value > h.value
            or (o.value = h.value and (
              o.date < h.date
              or (o.date = h.date and o.account_id < h.account_id)
            ))`;
  const ahead =
    view === OVERALL_VIEW
      ? `o.level > h.level
            or (o.level = h.level and (
            ${aheadOnValue}
            ))`
      : aheadOnValue;

  return `(
        select count(*) + 1
        from ${view} o
        where o.profile = h.profile
          and o.type = h.type
          and (
            ${ahead}
          )
      )::int`;
}

/** Every category one player appears in, with a rank for each. */
export function playerQuery(params: PlayerParams): Statement {
  return {
    text: `
    select
      0 as category,
      h.username,
      h.account_id,
      h.level,
      h.value,
      ${rankOf(OVERALL_VIEW)} as rank
    from ${OVERALL_VIEW} h
    where h.profile = $1 and h.type = 0 and h.username = $2
    union all
    select
      h.type as category,
      h.username,
      h.account_id,
      h.level,
      h.value,
      ${rankOf(SKILL_VIEW)} as rank
    from ${SKILL_VIEW} h
    where h.profile = $1 and h.username = $2
    order by category`,
    values: [params.profile, params.username],
  };
}
