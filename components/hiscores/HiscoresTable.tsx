"use client";

import { useEffect, useState } from "react";

import {
  parseHiscoresResponse,
  type HiscoresResponse,
} from "@/lib/hiscores/api";
import { CATEGORIES, categoryName } from "@/lib/hiscores/categories";
import { formatNumber } from "@/lib/hiscores/format";
import { statOfCategory } from "@/lib/skills/icons";
import {
  DEFAULT_PROFILE,
  parseTableParams,
  tableHref,
  type TableParams,
} from "@/lib/hiscores/params";
import { useSearchParams } from "next/navigation";

import SkillIcon from "@/components/game/SkillIcon";
import frame from "@/components/site/Frame.module.css";

import HiscoresHeader from "./HiscoresHeader";
import styles from "./Hiscores.module.css";

/**
 * `/hiscores` — one 21-row window of one category.
 *
 * The URL is the whole state: `category`, plus `rank` or `name`/`username`.
 * The same parser the API uses runs here first, so a bad parameter is a
 * message rather than a request, and the heading is right before the fetch
 * comes back.
 */

type State =
  | { kind: "loading" }
  | { kind: "ok"; data: HiscoresResponse }
  | { kind: "failed" };

/** The canonical query string for the API, built from the parsed params. */
function apiQuery(params: TableParams): string {
  const search = new URLSearchParams();
  search.set("profile", params.profile);
  search.set("category", String(params.category));
  if (params.selection.kind === "rank") {
    search.set("rank", String(params.selection.rank));
  }
  if (params.selection.kind === "name") {
    search.set("username", params.selection.username);
  }
  return search.toString();
}

const MESSAGES: Record<string, string> = {
  bad_category: "No such hiscore table.",
  bad_rank: "Enter a rank between 1 and 2,000,000.",
  bad_name: "That is not a name a player can have.",
  bad_profile: "No such hiscore profile.",
};

export default function HiscoresTable() {
  const searchParams = useSearchParams();
  const parsed = parseTableParams(searchParams);

  const query = parsed.ok ? apiQuery(parsed.value) : null;

  // The loaded result is stored *with the query it belongs to*, so navigating
  // to another category shows "Loading..." on the next render rather than the
  // previous category's rows — without a setState inside the effect.
  const [loaded, setLoaded] = useState<{ query: string; state: State } | null>(
    null,
  );
  const state: State =
    loaded && loaded.query === query ? loaded.state : { kind: "loading" };

  useEffect(() => {
    if (query === null) return;
    let active = true;

    void (async () => {
      let next: State;
      try {
        const response = await fetch(`/api/hiscores?${query}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        next = { kind: "ok", data: parseHiscoresResponse(await response.json()) };
      } catch {
        next = { kind: "failed" };
      }
      if (active) setLoaded({ query, state: next });
    })();

    return () => {
      active = false;
    };
  }, [query]);

  const category = parsed.ok ? parsed.value.category : 0;
  const profile = parsed.ok ? parsed.value.profile : DEFAULT_PROFILE;
  const selection = parsed.ok ? parsed.value.selection : { kind: "top" as const };

  return (
    <>
      <HiscoresHeader />

      <div className={styles.columns}>
        <div className={styles.left}>
          <b>Select hiscore table</b>
          <br />
          <div className={`${frame.panel} ${styles.listPanel}`}>
            <ul className={styles.categoryList}>
              {CATEGORIES.map((entry) => (
                <li key={entry.id}>
                  {/* 16px, and a blank one beside Overall: the 2004 list's
                      geometry, twenty rows in 380px. */}
                  <SkillIcon stat={statOfCategory(entry.id)} size={16} />
                  {/* Plain `?category=N`, as the 2004 site had it: switching
                      table clears the search rather than carrying a rank from
                      one skill to another, where it means something else. */}
                  <a
                    className={frame.link}
                    href={tableHref({ profile, category: entry.id })}
                  >
                    {entry.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className={styles.right}>
          <b>{categoryName(category) ?? "Unknown"} Hiscores</b>
          <br />
          <div className={`${frame.panel} ${styles.resultsPanel}`}>
            {!parsed.ok ? (
              <p className={styles.status} role="status">
                {MESSAGES[parsed.error] ?? "That request makes no sense."}
              </p>
            ) : state.kind === "loading" ? (
              <p className={styles.status} role="status">
                Loading...
              </p>
            ) : state.kind === "failed" ? (
              <p className={styles.status} role="status">
                Hiscores unavailable
              </p>
            ) : state.kind === "ok" && state.data.rows.length === 0 ? (
              // An unknown name, or a rank past the end of the table. The 2004
              // site showed the chrome round an empty table; so do we.
              <p className={styles.empty} role="status">
                No hiscores to show.
              </p>
            ) : state.kind === "ok" ? (
              <table className={styles.rows}>
                <thead>
                  <tr>
                    <th scope="col">Rank</th>
                    <th scope="col" className={styles.name}>
                      Name
                    </th>
                    <th scope="col">Level</th>
                    <th scope="col">XP</th>
                  </tr>
                </thead>
                <tbody>
                  {state.data.rows.map((row) => {
                    const lit = row.username === state.data.highlight;
                    return (
                      <tr key={row.username} className={lit ? frame.highlight : undefined}>
                        {/* The 2004 table prints the rank plain; only the
                            personal page groups it. */}
                        <td>{row.rank}</td>
                        <th scope="row" className={styles.name}>
                          <a
                            className={lit ? frame.highlight : frame.link}
                            href={`/hiscores/player/${encodeURIComponent(row.username)}`}
                          >
                            {row.name}
                          </a>
                        </th>
                        <td>{formatNumber(row.level)}</td>
                        <td>{formatNumber(row.xp)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : null}
          </div>
        </div>
      </div>

      <div className={styles.searches}>
        <div className={styles.searchBox}>
          <div className={frame.stone}>
            <form action="/hiscores">
              <b>Search by rank</b>
              <br />
              {/* Each box keeps its own current value, as the 2004 site did,
                  so refining a search does not mean retyping it. */}
              <input
                key={`rank-${selection.kind === "rank" ? selection.rank : ""}`}
                type="number"
                name="rank"
                min={1}
                size={12}
                defaultValue={
                  selection.kind === "rank" ? String(selection.rank) : ""
                }
                aria-label="Rank"
              />
              <br />
              <input type="hidden" name="category" value={category} />
              <input
                className={styles.searchButton}
                type="submit"
                value="Search"
              />
            </form>
          </div>
        </div>

        <div className={styles.searchBox}>
          <div className={frame.stone}>
            <form action="/hiscores" autoComplete="off">
              <b>Search by name</b>
              <br />
              <input
                key={`name-${selection.kind === "name" ? selection.username : ""}`}
                type="text"
                name="name"
                maxLength={12}
                size={12}
                defaultValue={
                  selection.kind === "name" ? selection.username : ""
                }
                autoComplete="off"
                aria-label="Name"
              />
              <br />
              <input type="hidden" name="category" value={category} />
              <input
                className={styles.searchButton}
                type="submit"
                value="Search"
              />
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
