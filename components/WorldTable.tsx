"use client";

import { useEffect, useState } from "react";

import {
  clientUrl,
  fetchWithTimeout,
  parseWorldInfo,
  parseWorlds,
  playersLabel,
  type CountState,
  type WorldEntry,
} from "@/lib/worlds";

import styles from "./WorldTable.module.css";

/** A world that is down often hangs rather than refusing the connection. */
const COUNT_TIMEOUT_MS = 5_000;
/** How often the player counts are refreshed while the page is open. */
const REFRESH_MS = 30_000;

const LOADING: CountState = { kind: "loading" };

type ListState =
  | { kind: "loading" }
  | { kind: "ok"; worlds: WorldEntry[] }
  | { kind: "failed" };

export default function WorldTable() {
  const [list, setList] = useState<ListState>({ kind: "loading" });
  const [counts, setCounts] = useState<Record<number, CountState>>({});

  // The world list is written to the site root by the deploy script, so it is
  // fetched at runtime rather than baked into the static export.
  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const response = await fetch("/worlds.json", { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`worlds.json: HTTP ${response.status}`);
        }
        const worlds = parseWorlds(await response.json());
        if (active) setList({ kind: "ok", worlds });
      } catch {
        if (active) setList({ kind: "failed" });
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const worlds = list.kind === "ok" ? list.worlds : null;

  useEffect(() => {
    if (!worlds) return;
    let active = true;

    const refresh = () => {
      for (const world of worlds) {
        void (async () => {
          let next: CountState;
          try {
            const response = await fetchWithTimeout(
              `${world.url}/world.json`,
              COUNT_TIMEOUT_MS,
            );
            if (!response.ok) {
              throw new Error(`world.json: HTTP ${response.status}`);
            }
            const info = parseWorldInfo(await response.json());
            next = {
              kind: "ok",
              players: info.players,
              maxPlayers: info.maxPlayers,
            };
          } catch {
            next = { kind: "offline" };
          }
          if (active) setCounts((prev) => ({ ...prev, [world.id]: next }));
        })();
      }
    };

    refresh();
    const timer = setInterval(refresh, REFRESH_MS);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [worlds]);

  if (list.kind === "failed") {
    return (
      <p className={styles.unavailable} role="status">
        World list unavailable
      </p>
    );
  }

  if (list.kind === "loading") {
    return (
      <p className={styles.status} role="status">
        Loading worlds...
      </p>
    );
  }

  if (list.worlds.length === 0) {
    return (
      <p className={styles.status} role="status">
        No worlds are configured yet.
      </p>
    );
  }

  return (
    // The table can outgrow a phone screen, so the region scrolls on its own
    // rather than the page. tabIndex keeps that scroll reachable by keyboard.
    <div
      className={styles.scroller}
      role="region"
      aria-label="World list"
      tabIndex={0}
    >
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">World</th>
            <th scope="col">Region</th>
            <th scope="col">Type</th>
            <th scope="col">Players</th>
            <th scope="col">Play</th>
          </tr>
        </thead>
        <tbody>
          {list.worlds.map((world) => {
            const count = counts[world.id] ?? LOADING;
            return (
              <tr key={world.id}>
                <th scope="row" className={styles.name}>
                  {world.name}
                </th>
                <td>{world.region}</td>
                <td>{world.members ? "Members" : "Free"}</td>
                <td
                  className={
                    count.kind === "offline" ? styles.offline : styles.players
                  }
                >
                  {playersLabel(count)}
                </td>
                <td>
                  {/* An inner element carries the flex layout: laying out the
                      cell itself as flex would drop its table semantics. */}
                  <div className={styles.links}>
                    <a
                      className={styles.link}
                      href={clientUrl(world.url, false)}
                      aria-label={`High detail: ${world.name}`}
                    >
                      High detail
                    </a>
                    <a
                      className={styles.link}
                      href={clientUrl(world.url, true)}
                      aria-label={`Low detail: ${world.name}`}
                    >
                      Low detail
                    </a>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
