"use client";

import { useEffect, useState } from "react";

import { useSearchParams } from "next/navigation";

import { boardHref, parseBoardParams, parseBoardResponse, type BoardResponse } from "@/lib/records/api";
import { DEFAULT_DURATION, recordDuration } from "@/lib/records/durations";
import { formatElapsed } from "@/lib/records/format";
import { CATEGORIES, categoryName } from "@/lib/hiscores/categories";
import { formatNumber } from "@/lib/hiscores/format";
import { statOfCategory } from "@/lib/skills/icons";

import SkillIcon from "@/components/game/SkillIcon";
import hiscores from "@/components/hiscores/Hiscores.module.css";
import frame from "@/components/site/Frame.module.css";

import styles from "./Records.module.css";

/**
 * `/hiscores/records` — one board: each player's best valid attempt for one
 * duration and one hiscore category.
 *
 * A hiscores page in all but the numbers it ranks, so it lives under
 * `/hiscores` (`/records` redirects here), with a link each way between the
 * two headers. Built the way the table is, and on its stylesheet: the URL is
 * the whole state (`?category=N`), the API's own parser runs here first so a
 * bad parameter is a message rather than a request, and the category list
 * down the side is the hiscores' list.
 */

type State =
  | { kind: "loading" }
  | { kind: "ok"; data: BoardResponse }
  | { kind: "failed" };

const MESSAGES: Record<string, string> = {
  bad_category: "No such record board.",
  bad_duration: "That isn't a record we run.",
};

export default function RecordsBoard() {
  const searchParams = useSearchParams();
  const parsed = parseBoardParams(searchParams);

  const query = parsed.ok
    ? `duration=${parsed.value.durationSeconds}&category=${parsed.value.category}`
    : null;

  // Stored with the query it answers, as the hiscores table does, so switching
  // board shows "Loading..." rather than the previous board's rows.
  const [loaded, setLoaded] = useState<{ query: string; state: State } | null>(null);
  const state: State = loaded && loaded.query === query ? loaded.state : { kind: "loading" };

  useEffect(() => {
    if (query === null) return;
    let active = true;

    void (async () => {
      let next: State;
      try {
        const response = await fetch(`/api/records/board?${query}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        next = { kind: "ok", data: parseBoardResponse(await response.json()) };
      } catch {
        next = { kind: "failed" };
      }
      if (active) setLoaded({ query, state: next });
    })();

    return () => {
      active = false;
    };
  }, [query]);

  const durationSeconds = parsed.ok ? parsed.value.durationSeconds : DEFAULT_DURATION.seconds;
  const duration = recordDuration(durationSeconds) ?? DEFAULT_DURATION;
  const category = parsed.ok ? parsed.value.category : 0;

  return (
    <>
      <div className={hiscores.spacer} />
      <div className={`${frame.panel} ${hiscores.header}`}>
        <b>Zanaris Records</b>
        <br />
        <a className={frame.link} href="/title">
          Main menu
        </a>
        {" - "}
        <a className={frame.link} href="/hiscores">
          Hiscores
        </a>
        {" - "}
        <a className={frame.link} href="/account/records">
          Set a record
        </a>
      </div>
      <div className={hiscores.spacer} />

      <div className={hiscores.columns}>
        <div className={hiscores.left}>
          <b>Select record board</b>
          <br />
          <div className={`${frame.panel} ${hiscores.listPanel}`}>
            <ul className={hiscores.categoryList}>
              {CATEGORIES.map((entry) => (
                <li key={entry.id}>
                  <SkillIcon stat={statOfCategory(entry.id)} size={16} />
                  <a
                    className={entry.id === category ? frame.highlight : frame.link}
                    href={boardHref({ durationSeconds, category: entry.id })}
                  >
                    {entry.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className={hiscores.right}>
          <b>
            {duration.adjective} {categoryName(category) ?? "Unknown"} records
          </b>
          <br />
          <div className={`${frame.panel} ${hiscores.resultsPanel}`}>
            {!parsed.ok ? (
              <p className={hiscores.status} role="status">
                {MESSAGES[parsed.error] ?? "That request makes no sense."}
              </p>
            ) : state.kind === "loading" ? (
              <p className={hiscores.status} role="status">
                Loading...
              </p>
            ) : state.kind === "failed" ? (
              <p className={hiscores.status} role="status">
                Records unavailable
              </p>
            ) : state.data.rows.length === 0 ? (
              <p className={hiscores.empty} role="status">
                No records yet. Be the first.
              </p>
            ) : (
              <table className={hiscores.rows}>
                <thead>
                  <tr>
                    <th scope="col">Rank</th>
                    <th scope="col" className={hiscores.name}>
                      Name
                    </th>
                    <th scope="col">XP</th>
                    <th scope="col">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {state.data.rows.map((row) => (
                    <tr key={row.username}>
                      <td>{row.rank}</td>
                      <th scope="row" className={hiscores.name}>
                        <a
                          className={frame.link}
                          href={`/hiscores/player/${encodeURIComponent(row.username)}`}
                        >
                          {row.name}
                        </a>
                      </th>
                      <td>{formatNumber(row.xp)}</td>
                      <td>{formatElapsed(row.elapsedMs)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      <p className={styles.boardNote}>
        Every record here was started and stopped on this site and measured by
        the server itself: the XP from the hiscores at a logout before the
        start and at the last logout inside the window. No screenshots, no
        videos, no guesswork.
      </p>
    </>
  );
}
