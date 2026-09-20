import ItemIcon from "@/components/game/ItemIcon";
import frame from "@/components/site/Frame.module.css";
import Panel from "@/components/site/Panel";
import { itemName } from "@/lib/items/names";
import { formatNumber, formatShortWhen } from "@/lib/public/format";
import type { SpawnRecord } from "@/lib/public/read-server";
import { staffSpawnClaim } from "@/lib/public/spawns";
import { ECONOMY_DEFAULT_WINDOW, ECONOMY_WIDEST_WINDOW } from "@/lib/public/queries";
import { ENGINE_SOURCES, engineFile } from "@/lib/site";

import EconomySections from "./EconomySections";
import styles from "./Public.module.css";

/** A link out to the engine, on the branch the fleet runs. */
function Source({ path, children }: { path: string; children: string }) {
  return (
    <a href={engineFile(path)} className={frame.link} rel="noreferrer">
      {children}
    </a>
  );
}

/**
 * How the census works, and — the part that matters — what it cannot show.
 *
 * This used to be eleven point-size text at the bottom of an eight-screen page,
 * under everything it explained. It is the page now, because the notes are the
 * only reason to believe the numbers: "coins in existence" means nothing at all
 * until you know it means coins in somebody's save file, counted hourly, not
 * counting the ground or the shops.
 *
 * The last block is the one this site would rather not write and is the reason
 * the page is worth having. We cannot prove what code the server is running.
 * Saying so, precisely, and saying what *would* prove it, is worth more than a
 * page of assurances — anybody can write assurances, and a reader who finds one
 * overstatement here is right to discount all of it.
 */
export default function EconomyAbout({ spawns }: { spawns: SpawnRecord }) {
  const claim = staffSpawnClaim(spawns.total, spawns.spawns, ECONOMY_WIDEST_WINDOW);
  const rows = spawns.spawns ?? [];

  return (
    <>
      <EconomySections current="about" window={ECONOMY_DEFAULT_WINDOW} />

      <Panel align="left" width="var(--panel-prose)">
        <div className={styles.blockTitle}>What the count includes</div>
        <div className={styles.prose}>
          <p>
            Once an hour, every save file on the server is read and everything
            in it is counted. That is the whole of it — there is no separate
            ledger, and nothing adds up totals as the game is played. The census
            opens the same files the game writes and counts what is inside them.
          </p>
          <ul>
            <li>
              It reads <b>save files</b>, once an hour. A player who is logged
              in is counted as their last save, so anything they have picked up
              since then appears at their next save, not immediately.
            </li>
            <li>
              It reads <b>every</b> save file, staff accounts among them.
              Nothing is left out of these totals, so a staff member&apos;s bank
              is in them like anybody else&apos;s.
            </li>
            <li>
              Items in <b>shop stock</b> and items lying on the <b>ground</b>{" "}
              are not in anybody&apos;s save and are not counted. Nor is
              anything held by an account that never logs out again.
            </li>
            <li>
              A <b>noted</b> item is counted as the item it is a note for. A
              note is redeemable one for one at any banker, so counting it
              separately would overstate how much of something exists. Searching
              for one finds the item it notes.
            </li>
            <li>
              <b>Shop value</b> is the price the game&apos;s own configuration
              gives an item, before a shop&apos;s stock multiplier and before
              anything a player would actually pay. It is not a market price and
              nobody trades at it. Many items declare no price at all — the
              holiday rares, bones, grimy herbs and dragonhides among them — so
              they are <i>counted</i> but not <i>valued</i>.
            </li>
            <li>
              <b>Rares entering and leaving the game</b> is the difference
              between one census and the next, for the fifteen tracked rares and
              nothing else. A trade moves an item between two saves and changes
              nothing there, which is the point.
            </li>
          </ul>
          <p>
            Nobody&apos;s name appears anywhere on these pages and nobody&apos;s
            bank is shown. The census counts objects, not owners.
          </p>
        </div>
      </Panel>

      <Panel align="left" width="var(--panel-prose)">
        <div className={styles.blockTitle}>How items could enter the game</div>
        <div className={styles.prose}>
          <p>
            Items are supposed to enter the game by being played for. A staff
            member can also conjure one out of nothing, and there would be no
            point counting anything if that were not said plainly, so:
          </p>
          <ul>
            <li>
              The cheats <code>::give</code>, <code>::givecrap</code>,{" "}
              <code>::givemany</code> and <code>::giveother</code> create items
              directly. Each one writes a row to the spawn log that this page
              prints below — the item, how many, and which world.{" "}
              <Source path={ENGINE_SOURCES.spawns}>
                notifyStaffSpawn, in World.ts
              </Source>{" "}
              is the function that does it.
            </li>
            <li>
              It logs what was <i>actually</i> created rather than what was
              asked for: a full backpack turns a request for a thousand into
              nothing, and nothing is not a spawn.
            </li>
          </ul>
          <p>Four ways an item could be created without a row appearing here:</p>
          <ul>
            <li>
              <b>A world not marked as production.</b> The log is skipped on dev
              worlds, so that somebody testing on their own machine does not
              write to the live record.
            </li>
            <li>
              <b>Editing the database directly.</b> Save files and rows can be
              changed by anyone with the credentials, and nothing in the game
              sees it happen.
            </li>
            <li>
              <b>Editing the content pack.</b> Shop stock, drop rates and
              spawn points are configuration rather than code. Changing them
              changes how much enters the game without creating a single item
              by hand.
            </li>
            <li>
              <b>Running a modified build,</b> or restoring an old backup over
              the current saves.
            </li>
          </ul>
          <p>
            The hourly census is the backstop for all four. An item that appears
            without a row still moves the totals on these pages, and those totals
            are published every hour whether or not anybody wants them to be. It
            would not say who, but it would say <i>something</i>, which is more
            than a log that can be avoided offers on its own.
          </p>
        </div>
      </Panel>

      <Panel align="left" width="var(--panel-prose)">
        <div className={styles.blockTitle}>{claim.label}</div>
        <div className={styles.prose}>
          <p>
            Every row the spawn log holds, oldest rules first: no window, no cap.
            It is meant to be empty, so there is nothing to paginate and nothing
            to summarise — a row here is a thing to look at rather than a
            statistic.
          </p>
        </div>
        {rows.length === 0 ? (
          <p className={styles.empty}>
            {claim.items === null
              ? "This could not be read just now."
              : claim.detail ??
                `Nothing has been created by staff in ${ECONOMY_WIDEST_WINDOW.label}.`}
          </p>
        ) : (
          <div className={styles.scroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.when}>When</th>
                  <th colSpan={2}>Item</th>
                  <th className={styles.figure}>Number</th>
                  <th className={styles.figure}>World</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((spawn, index) => (
                  <tr key={`${spawn.createdAt}-${spawn.itemId}-${index}`}>
                    <td className={styles.when}>
                      {formatShortWhen(spawn.createdAt)}
                    </td>
                    <td className={styles.icon}>
                      <ItemIcon id={spawn.itemId} />
                    </td>
                    <td>{itemName(spawn.itemId)}</td>
                    <td className={styles.figure}>
                      {formatNumber(spawn.count)}
                    </td>
                    <td className={styles.figure}>{spawn.world ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel align="left" width="var(--panel-prose)">
        <div className={styles.blockTitle}>The code that counts</div>
        <div className={styles.prose}>
          <p>
            Everything above is done by four files, and they are worth more to
            you than this page is:
          </p>
          <ul>
            <li>
              <Source path={ENGINE_SOURCES.census}>SaveCensus.ts</Source> — what
              runs every hour.
            </li>
            <li>
              <Source path={ENGINE_SOURCES.saves}>SaveReader.ts</Source> — how a
              save file is read.
            </li>
            <li>
              <Source path={ENGINE_SOURCES.counting}>economy.ts</Source> — how
              the contents are counted and written.
            </li>
            <li>
              <Source path={ENGINE_SOURCES.sql}>
                the migration
              </Source>{" "}
              — the database functions this website is allowed to call, and the
              exact columns they return. It is the reason no name can appear on
              these pages: the functions do not return one.
            </li>
          </ul>
        </div>
      </Panel>

      <Panel align="left" width="var(--panel-prose)">
        <div className={styles.blockTitle}>What these pages cannot prove</div>
        <div className={styles.prose}>
          <p>
            A transparency page that oversells itself is worse than none, so
            here is the limit of it.
          </p>
          <p>
            <b>We cannot prove which code the server is running.</b> The source
            above is what we say we run. Whoever owns the machine can run
            something else, and a server that reports its own version is
            reporting a string somebody chose to print. There is no arrangement
            of a server you control that makes its own claims about itself
            trustworthy — that is a property of who holds the keys, not of how
            carefully the page is written.
          </p>
          <p>
            The one technique that genuinely proves what a machine is running is
            hardware attestation, where the processor or the hosting platform
            signs a measurement of the loaded image with a key the operator does
            not hold. It is real and it is used in earnest elsewhere. It is also
            far out of proportion to a game server, and it would still not cover
            the content pack, or an administrator simply playing the game and
            earning things the ordinary way.
          </p>
          <p>
            <b>The past is not yet tamper-evident.</b> What is achievable, and
            is not in place today, is to chain each hourly census to the one
            before it and publish the running total somewhere we cannot rewrite.
            That would not prove what the server is doing now, but it would make
            quietly editing what it did last week detectable — which is the more
            useful of the two guarantees for an economy, and the honest thing to
            say is that we have not built it yet.
          </p>
          <p>
            Until then, what these pages offer is narrower and still worth
            something: the count is published every hour, it includes the
            people running the server, it is the same count whoever is reading,
            and the code that produces it is public. The rules are on the{" "}
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
