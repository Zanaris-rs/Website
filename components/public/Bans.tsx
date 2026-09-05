import { colourClass } from "@/components/site/colour";
import frame from "@/components/site/Frame.module.css";
import PageNav from "@/components/site/PageNav";
import Panel from "@/components/site/Panel";
import TitleBox from "@/components/site/TitleBox";
import {
  bansHref,
  displayName,
  endsColour,
  endsLabel,
  formatShortWhen,
  issuerLabel,
  punishmentKindLabel,
} from "@/lib/public/format";
import type { PunishmentPage } from "@/lib/public/queries";

import styles from "./Public.module.css";

/**
 * The permanent public record of every ban and mute.
 *
 * Two things about it are decisions rather than layout, and both are visible
 * in what this component does *not* have:
 *
 * - **No issuer.** A row says "A moderator" or "Automated" and there is no
 *   column for a name, because `public_punishments` does not return one. A
 *   moderator's name is not a player's business, and a public list of who
 *   banned whom is a list of who to go after.
 * - **No removals.** An expired ban and a lifted one stay on the record with
 *   their dates, rather than dropping off it. A record that quietly loses rows
 *   is not a record, and "lifted on the 3rd" is the row a wrongly-banned
 *   player most wants other people to be able to see.
 *
 * The arrows walk the list, not the calendar: "prev" is towards the newest
 * punishment, exactly as on the news pages.
 */
export default function Bans({ page }: { page: PunishmentPage }) {
  return (
    <>
      <PageNav
        prevHref={page.prevPage === null ? undefined : bansHref(page.prevPage)}
        nextHref={page.nextPage === null ? undefined : bansHref(page.nextPage)}
      >
        <TitleBox
          title="Bans and Mutes"
          links={[{ href: "/rules", text: "Rules" }]}
        />
      </PageNav>

      <Panel align="left">
        <div className={styles.intro}>
          <p>
            Every ban and every mute issued on Zanaris is listed here, newest
            first, and stays here — including the ones that have run out and the
            ones a moderator has since lifted. Moderation that nobody can check
            is moderation nobody can trust, so ours is on a page.
          </p>
          <p>
            What is not here is who issued it. A punishment says{" "}
            <b>A moderator</b> when a person decided it and <b>Automated</b>{" "}
            when the game did, and that is as specific as this page will ever
            get. If you think a punishment on your account is wrong, appeal it
            through the{" "}
            <a href="/messages" className={frame.link}>
              message centre
            </a>{" "}
            rather than looking for whoever issued it.
          </p>
        </div>
      </Panel>

      <Panel>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.name}>Player</th>
              <th>Type</th>
              <th className={styles.when}>Issued</th>
              <th className={styles.when}>Ends</th>
              <th className={styles.issuer}>Issued by</th>
            </tr>
          </thead>
          <tbody>
            {page.items.map((punishment, index) => {
              const colour = endsColour(punishment);
              return [
                <tr key={`${punishment.username}-${index}`}>
                  <td>{displayName(punishment.username)}</td>
                  <td>{punishmentKindLabel(punishment.kind)}</td>
                  <td className={styles.when}>
                    {formatShortWhen(punishment.issuedAt)}
                  </td>
                  <td
                    className={`${styles.when} ${colour ? colourClass[colour] : ""}`}
                  >
                    {endsLabel(punishment)}
                  </td>
                  <td className={styles.issuer}>
                    {issuerLabel(punishment.automated)}
                  </td>
                </tr>,
                punishment.note === "" ? null : (
                  <tr key={`${punishment.username}-${index}-note`}>
                    <td colSpan={5} className={styles.note}>
                      {punishment.note}
                    </td>
                  </tr>
                ),
              ];
            })}

            {page.items.length === 0 ? (
              <tr>
                <td colSpan={5} className={styles.empty}>
                  {page.page === 1
                    ? "No bans or mutes have been issued yet."
                    : "There is nothing on this page."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Panel>

      <Panel align="left">
        <p className={styles.caveat}>
          The record begins on the day this page went up. Punishments issued
          before then were never written down in a form that could be published,
          so they are not here — and nothing is ever removed from it after the
          fact.
        </p>
      </Panel>
    </>
  );
}
