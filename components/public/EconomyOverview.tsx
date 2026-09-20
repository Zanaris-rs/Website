import type { ReactNode } from "react";

import ItemIcon from "@/components/game/ItemIcon";
import { colourClass } from "@/components/site/colour";
import frame from "@/components/site/Frame.module.css";
import Panel from "@/components/site/Panel";
import { itemName } from "@/lib/items/names";
import {
  alignedSeries,
  chartSeries,
  dailyChange,
  latestSnapshot,
  netFlows,
} from "@/lib/public/economy";
import {
  flowColour,
  flowSentence,
  formatNumber,
  formatWhen,
  signed,
} from "@/lib/public/format";
import { ECONOMY_WIDEST_WINDOW, type Snapshot } from "@/lib/public/queries";
import type { EconomyOverview as OverviewData } from "@/lib/public/read-server";
import { staffSpawnClaim } from "@/lib/public/spawns";

import EconomyChart from "./EconomyChart";
import { CrosshairProvider } from "./EconomyCrosshair";
import EconomySections from "./EconomySections";
import EconomyWindows from "./EconomyWindows";
import styles from "./Public.module.css";

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

/** How many movements to print before the rest are on their own page. */
const TEASER_ROWS = 3;

/**
 * The top of the census: what exists, and the two claims worth leading with.
 *
 * This page was eight screens and six jobs. It is the first screen of it: the
 * totals, the shape they have been, whether staff have created anything, and
 * what moved in the last day — with everything that used to follow now a click
 * away instead of a scroll away.
 *
 * The staff figure is here rather than buried because it is the page's whole
 * argument. An empty four-column table said the same thing and said it in the
 * shape of a page that had failed to load.
 *
 * The two charts share one crosshair, which is only meaningful because
 * `alignedSeries` gives them one axis: hovering either names the same hour in
 * both.
 */
export default function EconomyOverview({ economy }: { economy: OverviewData }) {
  const { snapshots, window, spawns } = economy;
  const totals = latestSnapshot(snapshots);

  const coins = (snapshot: Snapshot) => snapshot.coins;
  const players = (snapshot: Snapshot) => snapshot.players;
  const [coinPoints, playerPoints] = alignedSeries(snapshots, [coins, players]);

  const claim = staffSpawnClaim(spawns.total, spawns.spawns, ECONOMY_WIDEST_WINDOW);
  const moved = economy.lastDay === null ? null : netFlows(economy.lastDay);

  return (
    <>
      <EconomySections current="overview" window={window} />

      <Panel align="left" width="var(--panel-prose)">
        <div className={styles.intro}>
          <p>
            Once an hour, every save file on the server is read and everything
            in it is counted — every coin, every ore, every rune, in every
            backpack, bank and set of worn equipment. Nobody&apos;s name appears
            on these pages and nobody&apos;s bank is shown; only the totals, and
            how far they have moved.
          </p>
        </div>
      </Panel>

      <Panel width="var(--panel-prose)">
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

            <CrosshairProvider>
              <EconomyChart
                title={`Coins in existence, ${window.short}`}
                points={chartSeries(coinPoints)}
                colour="yellow"
                unit="coin"
              />
              <EconomyChart
                title={`Accounts with a save, ${window.short}`}
                points={chartSeries(playerPoints)}
                colour="lblue"
                unit="account"
              />
            </CrosshairProvider>

            <div className={`${styles.chartScale} ${styles.counted}`}>
              <span>
                Counted {formatWhen(totals.takenAt)} across{" "}
                {figure(totals.players)} save files
              </span>
            </div>
          </>
        )}
      </Panel>

      <Panel width="var(--panel-prose)">
        <div className={styles.claim}>
          <div className={styles.claimValue}>{figure(claim.items)}</div>
          <div className={styles.totalLabel}>{claim.label}</div>
        </div>
        <p className={styles.note}>
          {claim.detail ?? "Nothing has been created by staff."}{" "}
          <a href="/economy/about" className={frame.link}>
            Every record, and how one is made
          </a>
          .
        </p>
      </Panel>

      <Panel align="left" width="var(--panel-prose)">
        <div className={styles.blockTitle}>Rares, in the last 24 hours</div>
        {moved === null ? (
          <div className={styles.empty}>This could not be read just now.</div>
        ) : moved.length === 0 ? (
          <div className={styles.empty}>
            No rare has entered or left the game in the last 24 hours.
          </div>
        ) : (
          <ul className={styles.dayList}>
            {moved.slice(0, TEASER_ROWS).map((item) => {
              const colour = flowColour(item.delta);
              return (
                <li key={item.itemId}>
                  <ItemIcon id={item.itemId} />
                  <span>
                    {itemName(item.itemId)} —{" "}
                    <span className={colour ? colourClass[colour] : undefined}>
                      {flowSentence(item.delta)}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <p className={styles.note}>
          <a href="/economy/rares" className={frame.link}>
            Rares entering and leaving the game
          </a>{" "}
          {moved !== null && moved.length > TEASER_ROWS
            ? `— the other ${moved.length - TEASER_ROWS}, and ${window.label}.`
            : `— day by day, over ${window.label}.`}
        </p>
      </Panel>
    </>
  );
}
