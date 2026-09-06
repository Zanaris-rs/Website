import account from "@/components/account/Account.module.css";
import messages from "@/components/messages/Messages.module.css";
import Panel from "@/components/site/Panel";
import TitleBox from "@/components/site/TitleBox";
import { toDisplayName } from "@/lib/base37";
import { formatWhen } from "@/lib/messages/format";
import { coordLabel, wealthEventLabel } from "@/lib/staff/format";
import { staffLinks } from "@/lib/staff/links";
import type { WealthRow } from "@/lib/staff/queries";

import styles from "./Staff.module.css";

/**
 * "What has this player traded, dropped, staked or died with?"
 *
 * The search box is a plain `<form method="get">` and the results are on the
 * URL, which is what makes a search shareable between moderators — and what
 * keeps this page free of any script at all.
 *
 * It reaches `session_wealth`, which keeps **seven days for everybody**, staff
 * only. That retention is the whole design: enough to adjudicate a report that
 * arrives days late, short enough that the site is not quietly building a
 * ledger of who owns what. The page says so, because a moderator who expects a
 * month of history and sees a week would otherwise read the gap as a bug.
 */
export default function StaffWealth({
  username,
  rows,
  error,
}: {
  /** What was searched for, canonicalised; `""` before the first search. */
  username: string;
  rows: readonly WealthRow[];
  /** A message when the name could not be used, rather than an empty table. */
  error: string | null;
}) {
  return (
    <>
      <TitleBox
        title="Wealth"
        links={staffLinks("/staff/wealth")}
      />

      <Panel align="left">
        <div className={account.heading}>
          <b>Wealth events</b>
        </div>

        <form method="get" action="/staff/wealth" className={account.form}>
          <div className={account.fields}>
            <label htmlFor="wealth-username">Player:</label>
            <input
              id="wealth-username"
              type="text"
              name="username"
              defaultValue={username}
              maxLength={12}
              autoComplete="off"
              required
            />
          </div>
          <div className={account.actions}>
            <button className={account.submit} type="submit">
              Search
            </button>
          </div>
        </form>

        {error === null ? null : (
          <p className={account.error} role="alert">
            {error}
          </p>
        )}

        {username === "" || error !== null ? null : rows.length === 0 ? (
          <p className={messages.empty}>
            Nothing for {toDisplayName(username)} in the last seven days. That
            is not the same as nothing ever: these rows are reaped at seven
            days, and small drops and pickups are never recorded at all.
          </p>
        ) : (
          <div className={messages.scroller}>
            <table className={`${messages.table} ${styles.tight}`}>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Event</th>
                  <th>Where</th>
                  <th>Items</th>
                  <th>Value</th>
                  <th>Other side</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((event, index) => (
                  <tr key={`${event.at}-${index}`}>
                    <td className={messages.when}>{formatWhen(event.at)}</td>
                    <td>{wealthEventLabel(event.eventType)}</td>
                    <td className={styles.name}>{coordLabel(event.coord)}</td>
                    <td className={styles.items}>{event.items}</td>
                    <td className={styles.name}>
                      {event.value === null ? "—" : event.value.toLocaleString()}
                    </td>
                    <td className={styles.items}>
                      {event.counterpart === ""
                        ? "—"
                        : event.counterpartItems === ""
                          ? // There was another party and the engine kept no
                            // item list for them. What it did keep is their
                            // session uuid, which is not a name, is not
                            // resolvable on this page, and is the identifier
                            // the rest of the site is careful never to print.
                            // "not recorded" is the whole of what is known.
                            "not recorded"
                          : event.counterpartItems}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className={account.note}>
          Wealth events are recorded for every player and kept seven days. They
          are <b>staff only</b> and never public — the economy page says what
          exists in the game, never who holds it.
        </p>
        <p className={account.note}>
          Drops and pickups under ten gold are filtered out by the world, and
          deaths, player kills and party-room drops arrive grouped as one event.
          The item lists are the engine&apos;s own and are shown as recorded.
        </p>
      </Panel>
    </>
  );
}
