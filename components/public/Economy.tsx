import type { ReactNode } from "react";

import ItemIcon from "@/components/game/ItemIcon";
import { colourClass } from "@/components/site/colour";
import frame from "@/components/site/Frame.module.css";
import Panel from "@/components/site/Panel";
import TitleBox from "@/components/site/TitleBox";
import { GROUPS, OTHER_GROUP, groupOf, groupRoster } from "@/lib/items/groups";
import { itemName } from "@/lib/items/names";
import { baseIdOf, itemCost } from "@/lib/items/objects";
import {
  type Block,
  dailyChange,
  dailyFlows,
  economyBlocks,
  latestSnapshot,
  rangeOf,
  seriesOf,
} from "@/lib/public/economy";
import type { Snapshot } from "@/lib/public/queries";
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
import EconomyGroups from "./EconomyGroups";
import EconomyWindows from "./EconomyWindows";
import styles from "./Public.module.css";

/** "1 day", "2 days": a page that says "1 days" reads as a machine wrote it. */
function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** A total, or a dash — a census that counted nothing must not print a zero. */
function figure(value: number | null): string {
  return value === null ? "—" : formatNumber(value);
}

/** "+12,400 in a day", or nothing at all until the series reaches back. */
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

/** "low 0 / high 11,940,980", under a total, in the charts' own scale line. */
function range(low: number | null, high: number | null): ReactNode {
  if (low === null || high === null) return null;
  return (
    <div className={styles.chartScale}>
      <span>low {formatNumber(low)}</span>
      <span>high {formatNumber(high)}</span>
    </div>
  );
}

/**
 * What the census told the page about every object in the game.
 *
 * `groupOf`, `baseIdOf`, `itemName` and `itemCost` all live in `lib/items`;
 * `economyBlocks` takes them as an argument so the arithmetic stays testable
 * against five made-up objects instead of 3,883 real ones.
 */
const CATALOGUE = {
  groupOf,
  baseIdOf,
  name: itemName,
  cost: itemCost,
};

const SPECS = GROUPS.map((group) => ({
  key: group.key,
  label: group.label,
  headline: group.headline,
  roster: groupRoster(group.key),
}));

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
 *
 * The current figures come from `census` — one row, the newest — and everything
 * with a window on it from the reads that took one. So the totals and the
 * category tables agree with each other by construction, whichever tab is open,
 * and only the charts and the low/high lines move when the window changes.
 */
export default function Economy({ economy }: { economy: EconomyData }) {
  const { census, snapshots, spawns, window, ranges } = economy;
  // The totals come from the census when there is one and from the newest
  // snapshot when there is not, so the top of the page survives a census read
  // that failed — including the deploy window before migration 5 is applied,
  // when `public_economy_latest()` does not exist yet. Both carry the same
  // three figures; only the category blocks below need the census itself.
  const totals = census ?? latestSnapshot(snapshots);
  // `null` all the way through rather than an empty list: the block below has
  // a different sentence for "could not be read" than for "nothing moved".
  const flows = economy.flows === null ? null : dailyFlows(economy.flows);
  const days = flows === null ? null : flows.days;
  // A block that could not be read, as opposed to one with nothing in it. The
  // census counts here only when there *are* snapshots: with none, the page is
  // not partial, it is new.
  const partial =
    economy.flows === null ||
    spawns === null ||
    ranges === null ||
    (census === null && snapshots.length > 0);

  const coins = (snapshot: Snapshot) => snapshot.coins;
  const players = (snapshot: Snapshot) => snapshot.players;
  const coinPoints = seriesOf(snapshots, coins);

  const blocks = economyBlocks(
    census?.items ?? [],
    ranges,
    SPECS,
    CATALOGUE,
    OTHER_GROUP,
  );

  // Coins lead the page as a figure of their own, so the group exists to keep
  // eleven million of them out of "Other items" rather than to be printed as a
  // block. Its range is the exact one over this window; the series is the
  // fallback for when that read failed.
  const isCoins = (block: Block) => block.key === "coins";
  const coinRange = blocks.find(isCoins) ?? null;
  const coinLow = coinRange?.low ?? rangeOf(coinPoints)?.low ?? null;
  const coinHigh = coinRange?.high ?? rangeOf(coinPoints)?.high ?? null;

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
            in it is counted — every coin, every ore, every rune, in every
            backpack, bank and set of worn equipment. This page is the whole of
            that count. Nobody&apos;s name appears on it and nobody&apos;s bank
            is shown; only the totals, and how far they have moved.
          </p>
        </div>
      </Panel>

      <Panel>
        <EconomyWindows current={window} />

        {totals === null ? (
          <div className={styles.empty}>
            The first census has not run yet. This page fills in within an hour
            of the count starting.
          </div>
        ) : (
          <>
            <div className={styles.totals}>
              <div className={styles.total}>
                <div className={styles.totalValue}>{figure(totals.coins)}</div>
                <div className={styles.totalLabel}>
                  coins in existence
                  {change(dailyChange(snapshots, coins))}
                </div>
              </div>
              <div className={styles.total}>
                <div className={styles.totalValue}>
                  {figure(totals.players)}
                </div>
                <div className={styles.totalLabel}>
                  accounts with a save
                  {change(dailyChange(snapshots, players))}
                </div>
              </div>
            </div>

            {range(coinLow, coinHigh)}

            <EconomyChart
              title={`Coins in existence, ${window.short}`}
              points={coinPoints}
              colour="yellow"
              unit="coins"
            />
            <EconomyChart
              title={`Accounts with a save, ${window.short}`}
              points={seriesOf(snapshots, players)}
              colour="lblue"
              unit="accounts"
            />

            <div className={`${styles.chartScale} ${styles.counted}`}>
              <span>
                Counted {formatWhen(totals.takenAt)} across{" "}
                {figure(totals.players)} save files
              </span>
            </div>
          </>
        )}
      </Panel>

      {census === null ? null : (
        <Panel align="left">
          <div className={styles.blockTitle}>Everything in the game</div>
          <EconomyGroups blocks={blocks.filter((block) => !isCoins(block))} />
        </Panel>
      )}

      <Panel align="left">
        <div className={styles.blockTitle}>Entered and left the game</div>
        {days === null ? (
          <div className={styles.empty}>This could not be read just now.</div>
        ) : days.length === 0 ? (
          <div className={styles.empty}>
            {flows?.truncated
              ? // Everything one read returns came from a single day, and a
                // part of a day is not a day. There is movement to show and
                // this page cannot honestly show it.
                "More movement was recorded in the last day than one read of this page returns, so none of it can be shown as a whole day."
              : `Nothing tracked has entered or left the game in ${window.label}.`}
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
                      <ItemIcon id={item.itemId} />
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
        {flows !== null && flows.truncated && days !== null && days.length > 0 ? (
          <p className={styles.note}>
            The census wrote more rows in this window than one read returns, so
            this is the newest {plural(days.length, "day")} rather than the
            whole {window.days}: older days are not loaded. The day the read
            stopped inside is left out rather than shown as a part of itself.
          </p>
        ) : null}
      </Panel>

      <Panel>
        <div className={styles.blockTitle}>Added by staff</div>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.when}>When</th>
              <th>Item</th>
              <th className={styles.figure}>Number</th>
              <th className={styles.figure}>World</th>
            </tr>
          </thead>
          <tbody>
            {(spawns ?? []).map((spawn, index) => (
              <tr key={`${spawn.createdAt}-${spawn.itemId}-${index}`} className={styles.itemRow}>
                <td className={styles.when}>
                  {formatShortWhen(spawn.createdAt)}
                </td>
                <td>
                  <ItemIcon id={spawn.itemId} />
                  {itemName(spawn.itemId)}
                </td>
                <td className={styles.figure}>{formatNumber(spawn.count)}</td>
                <td className={styles.figure}>{spawn.world ?? "—"}</td>
              </tr>
            ))}
            {spawns === null || spawns.length === 0 ? (
              <tr>
                <td colSpan={4} className={styles.empty}>
                  {spawns === null
                    ? "This could not be read just now."
                    : `Staff have created nothing in ${window.label}.`}
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
              A block above could not be read just now and says so where it
              would otherwise list something. It will right itself on the next
              refresh; nothing is missing from the totals.
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
              It reads <b>every</b> save file, staff accounts among them.
              Nothing is left out of these totals, so a staff member&apos;s bank
              is in them like anybody else&apos;s — and everything staff have
              created is listed above, so it is accounted for rather than
              hidden.
            </li>
            <li>
              Items in <b>shop stock</b> and items lying on the <b>ground</b>{" "}
              are not in anybody&apos;s save and are not counted. Nor is
              anything held by an account that never logs out again.
            </li>
            <li>
              A <b>noted</b> item is counted as the item it is a note for. A
              note is redeemable one for one at any banker, so counting it
              separately would understate how much of something exists.
            </li>
            <li>
              <b>Shop value</b> is the price the game&apos;s own configuration
              gives an item, before a shop&apos;s stock multiplier and before
              anything a player would actually pay. It is not a market price and
              nobody trades at it. Many items declare no price at all — the
              holiday rares, bones, grimy herbs and dragonhides among them — so
              they are <i>counted</i> but not <i>valued</i>, and a block says
              how many of its items it could price.
            </li>
            <li>
              &quot;Entered the game&quot; and &quot;left the game&quot; are the
              difference between one census and the next, for the rares only. A
              trade moves an item between two saves and changes nothing here,
              which is the point.
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
