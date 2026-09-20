import type { ReactNode } from "react";

import { colourClass } from "@/components/site/colour";
import frame from "@/components/site/Frame.module.css";
import Panel from "@/components/site/Panel";
import { GROUPS, OTHER_GROUP, groupOf, groupRoster } from "@/lib/items/groups";
import { itemName } from "@/lib/items/names";
import { baseIdOf, itemCost } from "@/lib/items/objects";
import {
  alignedSeries,
  chartSeries,
  dailyChange,
  economyBlocks,
  latestSnapshot,
} from "@/lib/public/economy";
import {
  flowColour,
  formatNumber,
  formatWhen,
  signed,
} from "@/lib/public/format";
import {
  type Census,
  ECONOMY_WIDEST_WINDOW,
  type Snapshot,
} from "@/lib/public/queries";
import type { EconomyOverview as OverviewData } from "@/lib/public/read-server";
import { staffSpawnClaim } from "@/lib/public/spawns";

import EconomyChart from "./EconomyChart";
import EconomyGroups from "./EconomyGroups";
import { CrosshairProvider } from "./EconomyCrosshair";
import EconomySections from "./EconomySections";
import EconomyWindows from "./EconomyWindows";
import styles from "./Public.module.css";

/**
 * The categories worth putting on the front page.
 *
 * Six of the eleven, in the order a player would think of them: what is rare,
 * what is mined and smelted, and what is cut and caught. The rest are a click
 * away on `/economy/items`, which has all of them and a search as well — these
 * are here so that "what exists in the game" is something you can see rather
 * than something you have to go and look for.
 */
const OVERVIEW_GROUPS = ["rares", "runes", "ores", "bars", "logs", "fish"];

const CATALOGUE = {
  groupOf,
  baseIdOf,
  name: itemName,
  cost: itemCost,
};

/** The six overview categories, counted from the newest census. */
function overviewBlocks(census: Census | null) {
  if (census === null) return null;
  const specs = OVERVIEW_GROUPS.map((key) => {
    const group = GROUPS.find((candidate) => candidate.key === key);
    return {
      key,
      label: group?.label ?? key,
      headline: group?.headline,
      roster: groupRoster(key),
    };
  });
  // `economyBlocks` always appends a residual block for everything no spec
  // claimed, which here would be the other five categories in one heap. It is
  // dropped by key rather than by position, so a change to that function's
  // ordering cannot quietly put three thousand items on the front page.
  return economyBlocks(census.items, null, specs, CATALOGUE, OTHER_GROUP).filter(
    (block) => OVERVIEW_GROUPS.includes(block.key),
  );
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
  const census = overviewBlocks(economy.census);

  return (
    <>
      <EconomySections current="overview" window={window} />

      <Panel align="left" width="var(--panel-prose)">
        <div className={styles.intro}>
          <p>
            Once an hour, every save file on the server is read and everything
            inside is counted. Nobody&apos;s name appears on these pages and
            nobody&apos;s bank is shown. This is the server totals.{" "}
            <a href="/economy/about" className={frame.link}>
              Learn more
            </a>
            .
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

      {census === null ? null : (
        <Panel align="left" width="var(--panel-wide)">
          <div className={styles.blockTitle}>What exists in the game</div>
          <EconomyGroups blocks={census} />
          <p className={styles.note}>
            <a href="/economy/items" className={frame.link}>
              Every item in the game
            </a>{" "}
            - all 3,883 of them, with a search over the lot.
          </p>
        </Panel>
      )}

    </>
  );
}
