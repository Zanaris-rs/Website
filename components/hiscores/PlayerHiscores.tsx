"use client";

import { useEffect, useState } from "react";

import { useSearchParams } from "next/navigation";

import { toDisplayName } from "@/lib/base37";
import { parsePlayerResponse, type PlayerResponse } from "@/lib/hiscores/api";
import { categoryName } from "@/lib/hiscores/categories";
import { formatNumber } from "@/lib/hiscores/format";
import { DEFAULT_PROFILE } from "@/lib/hiscores/params";
import { formatCitizen } from "@/lib/invite/format";
import { statOfCategory } from "@/lib/skills/icons";

import SkillIcon from "@/components/game/SkillIcon";
import frame from "@/components/site/Frame.module.css";

import HiscoresHeader from "./HiscoresHeader";
import styles from "./Hiscores.module.css";

/**
 * `/hiscores/player/<username>` — every category one player appears in.
 *
 * A player with no rows at all gets "No player <Name> found" rather than an
 * empty table: an empty table here is indistinguishable from a typo, and a
 * typo is by far the more common reason to land on this page.
 */

type State =
  | { kind: "loading" }
  | { kind: "ok"; data: PlayerResponse }
  | { kind: "missing" }
  | { kind: "failed" };

export default function PlayerHiscores({ username }: { username: string }) {
  const searchParams = useSearchParams();
  const profile = searchParams.get("profile") ?? DEFAULT_PROFILE;
  const key = `${username}|${profile}`;

  // Keyed by the request it answers, so switching player or profile shows
  // "Loading..." rather than the previous player's rows.
  const [loaded, setLoaded] = useState<{ key: string; state: State } | null>(
    null,
  );
  const state: State =
    loaded && loaded.key === key ? loaded.state : { kind: "loading" };

  useEffect(() => {
    let active = true;

    void (async () => {
      let next: State;
      try {
        const response = await fetch(
          `/api/hiscores/player/${encodeURIComponent(username)}?profile=${encodeURIComponent(profile)}`,
        );
        if (response.status === 404) {
          next = { kind: "missing" };
        } else if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        } else {
          next = { kind: "ok", data: parsePlayerResponse(await response.json()) };
        }
      } catch {
        next = { kind: "failed" };
      }
      if (active) setLoaded({ key, state: next });
    })();

    return () => {
      active = false;
    };
  }, [key, username, profile]);

  // Shown while loading and when the player does not exist, so the page never
  // flashes a blank name.
  const name = state.kind === "ok" ? state.data.name : toDisplayName(username);

  return (
    <>
      <HiscoresHeader showAllLink />

      <div className={`${frame.panel} ${styles.playerPanel}`}>
        {state.kind === "missing" ? (
          <div className={styles.playerHeading} role="status">
            No player <span className={frame.highlight}>{name}</span> found
          </div>
        ) : state.kind === "failed" ? (
          <div className={styles.playerHeading} role="status">
            Hiscores unavailable
          </div>
        ) : state.kind === "loading" ? (
          <div className={styles.playerHeading} role="status">
            Loading...
          </div>
        ) : (
          <>
            <div className={styles.playerHeading}>
              Zanaris Hiscores for{" "}
              <span className={frame.highlight}>{name}</span>
            </div>
            {state.data.citizen !== null ? (
              <div className={styles.playerHeading}>
                Citizen {formatCitizen(state.data.citizen)}
              </div>
            ) : null}
            <div className={styles.playerHeading}>
              <a
                className={frame.link}
                href={`/adventurer-log/${encodeURIComponent(state.data.username)}`}
              >
                Adventurer Log
              </a>
            </div>
            <table className={styles.playerTable}>
              <thead>
                <tr>
                  <th scope="col" className={styles.skill}>
                    Skill
                  </th>
                  <th scope="col" className={styles.figure}>
                    Rank
                  </th>
                  <th scope="col" className={styles.figure}>
                    Level
                  </th>
                  <th scope="col" className={styles.figure}>
                    XP
                  </th>
                </tr>
              </thead>
              <tbody>
                {state.data.skills.map((skill) => (
                  <tr key={skill.category}>
                    <th scope="row" className={styles.skill}>
                      <SkillIcon stat={statOfCategory(skill.category)} size={16} />
                      <a
                        className={frame.link}
                        href={`/hiscores?username=${encodeURIComponent(state.data.username)}&category=${skill.category}`}
                      >
                        {categoryName(skill.category) ?? `#${skill.category}`}
                      </a>
                    </th>
                    <td className={styles.figure}>{formatNumber(skill.rank)}</td>
                    <td className={styles.figure}>
                      {formatNumber(skill.level)}
                    </td>
                    <td className={styles.figure}>{formatNumber(skill.xp)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </>
  );
}
