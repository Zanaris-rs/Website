import type { ReactNode } from "react";

import { colourClass } from "@/components/site/colour";
import frame from "@/components/site/Frame.module.css";
import Panel from "@/components/site/Panel";
import TitleBox from "@/components/site/TitleBox";
import { itemName } from "@/lib/items/names";
import {
  dailyChange,
  dailyFlows,
  latestSnapshot,
  seriesOf,
} from "@/lib/public/economy";
import { ECONOMY_DAYS, type Snapshot } from "@/lib/public/queries";
import type { Economy as EconomyData } from "@/lib/public/read-server";
import {
  flowColour,
  flowSentence,
  formatNumber,
  formatShortWhen,
  formatWhen,
  signed,
} from "@/lib/public/format";

import EconomyChart from "./EconomyChart";
import styles from "./Public.module.css";

/** A total, or a dash — a census that counted nothing must not print a zero. */
function figure(value: number | null): string {
  return value === null ? "—" : formatNumber(value);
}

/** "+12,400 in the last day", or nothing at all until the series reaches back. */
function change(value: number | null): ReactNode {
  if (value === null || value === 0) return null;
  const colour = flowColour(value);
  return (
    <span className={colour ? colourClass[colour] : undefined}>
      {" "}
      {signed(value)} in a day
    </span>
  );
}

/**
 * What exists in the game, and what has moved.
 *
 * Everything on this page comes from an hourly census of the save files, and
 * the page says so twice — once in the opening paragraph and once in the list
 * of things the count deliberately leaves out — because a number without its
 * definition is worse than no number. "Coins in existence" means coins in
 * somebody's save file: not in a shop, not on the ground, and not in the
 * pocket of a player who has been logged in since before the last save.
 *
 * There are no names anywhere on it, including in the staff-spawn list. The
 * census counts objects, not owners; `public_staff_spawns` returns the item,
 * the number and the world and nothing else. That is the trade the whole
 * feature is built on: the totals are everybody's business and who holds them
 * is nobody's.
 */
export default function Economy({ economy }: { economy: EconomyData }) {
  const { snapshots, spawns, partial } = economy;
  const latest = latestSnapshot(snapshots);
  const days = dailyFlows(economy.flows);

  const coins = (snapshot: Snapshot) => snapshot.coins;
  const players = (snapshot: Snapshot) => snapshot.players;

  return (
    <>
      <TitleBox
        title="The Economy"
        links={[{ href: "/bans", text: "Bans and mutes" }]}
      />

      <Panel align="left">
        <div className={styles.intro}>
          <p>
            Once an hour, every save file on the server is read and everything
            in it is counted. This page is the result: how many coins exist, how
            many accounts have a save, and how many of the rarest items in the
            game are still out there. Nobody&apos;s name appears on it, and
            nobody&apos;s bank is shown — only the totals.
          </p>
        </div>
      </Panel>

      <Panel>
        {latest === null ? (
          <div className={styles.empty}>
            The first census has not run yet. This page fills in within an hour
            of the count starting.
          </div>
        ) : (
          <>
            <div className={styles.totals}>
              <div className={styles.total}>
                <div className={styles.totalValue}>{figure(latest.coins)}</div>
                <div className={styles.totalLabel}>
                  coins in existence
                  {change(dailyChange(snapshots, coins))}
                </div>
              </div>
              <div className={styles.total}>
                <div className={styles.totalValue}>
                  {figure(latest.players)}
                </div>
                <div className={styles.totalLabel}>
                  accounts with a save
                  {change(dailyChange(snapshots, players))}
                </div>
              </div>
            </div>

            <EconomyChart
              title={`Coins in existence, ${ECONOMY_DAYS} days`}
              points={seriesOf(snapshots, coins)}
              colour="yellow"
              unit="coins"
            />
            <EconomyChart
              title={`Accounts with a save, ${ECONOMY_DAYS} days`}
              points={seriesOf(snapshots, players)}
              colour="lblue"
              unit="accounts"
            />

            <div className={`${styles.chartScale} ${styles.counted}`}>
              <span>Counted {formatWhen(latest.takenAt)}</span>
            </div>
          </>
        )}
      </Panel>

      <Panel>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Tracked item</th>
              <th className={styles.figure}>In existence</th>
            </tr>
          </thead>
          <tbody>
            {(latest?.tracked ?? []).map((item) => (
              <tr key={item.id}>
                <td>{itemName(item.id)}</td>
                <td className={styles.figure}>{formatNumber(item.count)}</td>
              </tr>
            ))}
            {(latest?.tracked.length ?? 0) === 0 ? (
              <tr>
                <td colSpan={2} className={styles.empty}>
                  No tracked items have been counted yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Panel>

      <Panel align="left">
        <div className={styles.chartTitle}>Entered and left the game</div>
        {days.length === 0 ? (
          <div className={styles.empty}>
            Nothing tracked has entered or left the game in the last{" "}
            {ECONOMY_DAYS} days.
          </div>
        ) : (
          days.map((day) => (
            <div key={day.day} className={styles.day}>
              <div className={styles.dayHeading}>{formatShortWhen(day.day)}</div>
              <ul className={styles.dayList}>
                {day.items.map((item) => {
                  const colour = flowColour(item.delta);
                  return (
                    <li key={item.itemId}>
                      {itemName(item.itemId)} —{" "}
                      <span className={colour ? colourClass[colour] : undefined}>
                        {flowSentence(item.delta)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </Panel>

      <Panel>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.when}>Added by staff</th>
              <th>Item</th>
              <th className={styles.figure}>Number</th>
              <th className={styles.figure}>World</th>
            </tr>
          </thead>
          <tbody>
            {spawns.map((spawn, index) => (
              <tr key={`${spawn.createdAt}-${spawn.itemId}-${index}`}>
                <td className={styles.when}>
                  {formatShortWhen(spawn.createdAt)}
                </td>
                <td>{itemName(spawn.itemId)}</td>
                <td className={styles.figure}>{formatNumber(spawn.count)}</td>
                <td className={styles.figure}>{spawn.world ?? "—"}</td>
              </tr>
            ))}
            {spawns.length === 0 ? (
              <tr>
                <td colSpan={4} className={styles.empty}>
                  Staff have created nothing in the last {ECONOMY_DAYS} days.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Panel>

      <Panel align="left">
        <div className={styles.caveat}>
          {partial ? (
            <p>
              Part of this page could not be read just now, so a block above may
              be showing less than it should. It will right itself on the next
              refresh.
            </p>
          ) : null}
          <p>What the count does and does not include:</p>
          <ul>
            <li>
              It reads <b>save files</b>, once an hour. A player who is logged
              in is counted as their last save, so anything they have picked up
              since then appears at their next save, not immediately.
            </li>
            <li>
              Items in <b>shop stock</b> and items lying on the <b>ground</b>{" "}
              are not in anybody&apos;s save and are not counted. Nor is
              anything held by an account that never logs out again.
            </li>
            <li>
              &quot;Entered the game&quot; and &quot;left the game&quot; are the
              difference between one census and the next. A trade moves an item
              between two saves and changes nothing here, which is the point.
            </li>
            <li>
              Items a member of staff created are listed above, without the name
              of the staff member or of whoever received them.
            </li>
          </ul>
          <p>
            The rules that govern all of this are on the{" "}
            <a href="/rules" className={frame.link}>
              rules page
            </a>
            , and every ban and mute is on{" "}
            <a href="/bans" className={frame.link}>
              the ban record
            </a>
            .
          </p>
        </div>
      </Panel>
    </>
  );
}
