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
 * How the census works, and - the part that matters - what it cannot show.
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
 * page of assurances - anybody can write assurances, and a reader who finds one
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
            in it is counted. That is the whole of it - there is no separate
            ledger, and nothing adds up totals as the game is played. The census
            opens the same files the game writes and counts what is inside them.
          </p>
          <ul>
            <li>
              It reads <b>save files</b>, once an hour. Every player who is
              logged in is saved every fifteen minutes, so what somebody is
              carrying right now can be up to that far behind.
            </li>
            <li>
              It reads <b>every</b> save file, staff accounts among them.
              Nothing is left out of these totals, so a staff member&apos;s bank
              is in them like anybody else&apos;s.
            </li>
            <li>
              Items in <b>shop stock</b> and items lying on the <b>ground</b>{" "}
              are not in anybody&apos;s save and are not counted. An item
              dropped on the floor leaves these totals until somebody picks it
              up.
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
              nobody trades at it.
            </li>
          </ul>
          <p>The census counts items, not owners.</p>
        </div>
      </Panel>

      <Panel align="left" width="var(--panel-prose)">
        <div className={styles.blockTitle}>How items enter the game</div>
        <div className={styles.prose}>
          <p>
            Almost everything in the game got there by being played for: mined,
            caught, killed for, bought from a shop. There are two other ways,
            and they are the reason this page exists.
          </p>

          <p>
            <b>1. An admin can create items with a cheat.</b>
          </p>
          <p>
            Zanaris runs as a <b>production server</b>, and that setting decides
            what is possible. On a production server the item cheats are
            restricted to <b>admin</b> accounts - a moderator cannot use them -
            and every one of them is written to the log below. There are four:
          </p>
          <ul>
            <li>
              <code>::give</code> - puts an item, or several, straight into the
              admin&apos;s own backpack.
            </li>
            <li>
              <code>::givemany</code> - the same thing, up to a thousand at
              once.
            </li>
            <li>
              <code>::givecrap</code> - fills the admin&apos;s backpack with
              twenty-eight random items.
            </li>
            <li>
              <code>::giveother</code> - puts an item into{" "}
              <b>another player&apos;s</b> backpack. They must be logged in at
              the time.
            </li>
          </ul>
          <p>
            All four put items into a <b>backpack</b>. There is no cheat that
            puts an item on the floor. An admin can of course then drop it like
            any player, and anybody who walks past can pick it up - which is
            exactly why the item is logged the moment it is created, and not
            when it moves.
          </p>
          <p>
            The log records what actually arrived, not what was asked for. A
            request for a thousand into a backpack with four free slots creates
            four, and four is what it says.
          </p>

          <p>
            <b>2. Whoever runs the server can edit a save file.</b>
          </p>
          <p>
            Every account is a file on the server, and the person who owns the
            machine can open one and change the numbers in it. Nothing in the
            game happens, so nothing in the game logs it. The same is true of
            the database behind it, of the files that set shop stock and drop
            rates, and of restoring an old backup over the current saves.
          </p>
          <p>
            There is no log that can catch that, because the log lives inside
            the thing being edited. What catches it is this page. The census
            reads the save files an hour later and counts what is in them, so
            items that appeared from nowhere still turn up in the totals - and
            the totals are published whether or not anybody wants them to be. It
            cannot say who did it. It can say that it happened.
          </p>
        </div>
      </Panel>

      <Panel align="left" width="var(--panel-prose)">
        <div className={styles.blockTitle}>{claim.label}</div>
        <div className={styles.prose}>
          <p>
            Every row the spawn log holds, newest first: no window, no cap.
            It is meant to be empty, so there is nothing to paginate and nothing
            to summarise - a row here is a thing to look at rather than a
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
                    <td className={styles.figure}>{spawn.world ?? "-"}</td>
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
            Everything above is done by three files, and they are worth more to
            you than this page is:
          </p>
          <ul>
            <li>
              <Source path={ENGINE_SOURCES.census}>SaveCensus.ts</Source> - what
              runs every hour.
            </li>
            <li>
              <Source path={ENGINE_SOURCES.saves}>SaveReader.ts</Source> - how a
              save file is read.
            </li>
            <li>
              <Source path={ENGINE_SOURCES.counting}>economy.ts</Source> - how
              the contents are counted and written.
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
            trustworthy - that is a property of who holds the keys, not of how
            carefully the page is written.
          </p>
          <p>
            <b>The past is not yet tamper-evident.</b> Today these pages show
            you the newest count. If we quietly changed an older one, you would
            have nothing to check it against.
          </p>
          <p>
            That part we can fix, and intend to. We will publish an API that
            hands out each hourly census as it was taken, so anybody can keep
            their own copy of the record rather than trusting ours. Once enough
            people hold copies, changing history stops being something we can do
            quietly - it becomes something that disagrees with everybody
            else&apos;s copy. We would rather provide the tool that does the
            checking too, so it takes one command and not an afternoon.
          </p>
          <p>
            That still would not prove what the server is doing right now.
            Nothing we can build will. It would prove we have not been editing
            what it already did, which is the part worth having.
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
