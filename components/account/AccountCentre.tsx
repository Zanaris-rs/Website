import { toDisplayName } from "@/lib/base37";
import {
  type Profile,
  type RecentLogin,
  accountStatus,
  formatDay,
  formatWhen,
  presenceLine,
} from "@/lib/account/profile";
import ChatheadFace from "@/components/game/ChatheadFace";
import frame from "@/components/site/Frame.module.css";
import Panel from "@/components/site/Panel";
import TitleBox from "@/components/site/TitleBox";
import { colourClass } from "@/components/site/colour";
import { DIRECTORY_HREF, logHref } from "@/lib/adventurer-log/href";
import type { Look } from "@/lib/chathead/look";
import { formatCitizen } from "@/lib/invite/format";
import type { Citizen } from "@/lib/invite/queries";
import { unreadLabel } from "@/lib/messages/format";
import { isStaff } from "@/lib/staff/level";

import LogoutButton from "./LogoutButton";
import styles from "./Account.module.css";

/**
 * The account centre: what this account is, what is currently true about it,
 * where it has been logged in from, and, side by side at the bottom, what you
 * can do with the account and with the character everyone else sees.
 *
 * Everything on this page is read from the database on the request that
 * renders it — including the staff level, which the session cookie never
 * carries. A cookie says who you are and nothing about what you may do.
 *
 * A ban or a mute is shown, not hidden and not enforced here: this is exactly
 * the page somebody who cannot play needs to be able to reach.
 */
export default function AccountCentre({
  profile,
  logins,
  unread,
  citizen,
  look,
}: {
  profile: Profile;
  logins: readonly RecentLogin[];
  /**
   * Unread messages, counted by `accounts.unread` — the cross-repo contract
   * count, the same number the game's welcome screen shows. `undefined` when
   * that one read failed, which prints no count at all rather than a "0" the
   * page cannot stand behind.
   */
  unread?: number;
  /** `accounts.citizen`; undefined when that read failed. */
  citizen?: Citizen;
  /** The chathead on your Adventurer Log (`chatheadLooks`), if there is one. */
  look?: Look | null;
}) {
  const notices = accountStatus(profile);
  const presence = presenceLine(profile);

  return (
    <>
      <TitleBox title="Account Centre" />

      <Panel>
        <div className={styles.form}>
          <div className={styles.details}>
            <span className={styles.label}>Username:</span>
            <span>{toDisplayName(profile.username)}</span>

            {citizen ? (
              <>
                <span className={styles.label}>Citizen:</span>
                <span>{formatCitizen(citizen.citizenNumber)}</span>

                {citizen.invitedBy ? (
                  <>
                    <span className={styles.label}>Invited by:</span>
                    <span>{toDisplayName(citizen.invitedBy)}</span>
                  </>
                ) : null}
              </>
            ) : null}

            <span className={styles.label}>Account type:</span>
            <span>{profile.members ? "Members" : "Free"}</span>

            <span className={styles.label}>Registered:</span>
            <span>{formatDay(profile.registrationDate)}</span>

            <span className={styles.label}>Contact email:</span>
            <span>{profile.email || "none"}</span>

            {profile.staffModLevel > 0 ? (
              <>
                <span className={styles.label}>Staff level:</span>
                <span>{profile.staffModLevel}</span>
              </>
            ) : null}
          </div>

          {notices.map((notice) => (
            <p
              key={notice.kind}
              className={`${styles.notice} ${colourClass[notice.colour]}`}
            >
              {notice.text}
            </p>
          ))}

          {presence ? <p className={styles.presence}>{presence}</p> : null}
        </div>
      </Panel>

      <Panel>
        <div className={styles.form}>
          <div className={styles.heading}>
            <b>Recent logins</b>
          </div>

          {logins.length === 0 ? (
            <p>This account has never logged in to the game.</p>
          ) : (
            <div className={styles.scroller}>
            <table className={styles.logins}>
              <thead>
                <tr>
                  <th>When</th>
                  <th>World</th>
                  <th>Address</th>
                </tr>
              </thead>
              <tbody>
                {logins.map((login, index) => (
                  <tr key={`${login.loggedInAt ?? "?"}-${index}`}>
                    <td>{formatWhen(login.loggedInAt)}</td>
                    <td>{login.world}</td>
                    <td className={styles.ip}>{login.ip ?? "unknown"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}

          <p className={styles.note}>
            These are your own game logins. If one of them is not you, change
            your password now — it also signs every other device out.
          </p>
        </div>
      </Panel>

      {/* Two panels side by side (stacked on a phone): the account's own
          services, and "Your Adventurer" - the log, its settings and the
          outfits its picture comes from. Each panel sits in a column div so
          the two are not sibling panels, which would push the second down
          by the stack gap. */}
      <div className={styles.services}>
        <div className={styles.column}>
          <Panel>
            <div className={styles.form}>
              <div className={styles.heading}>
                <b>Account services</b>
              </div>
              <ul className={styles.links}>
                {citizen?.invitesEnabled ? (
                  <li>
                    <a className={frame.link} href="/account/invites">
                      Invite someone to Zanaris
                    </a>
                  </li>
                ) : null}
                <li>
                  <a className={frame.link} href="/account/password">
                    Change your password
                  </a>
                </li>
                <li>
                  <a className={frame.link} href="/account/email">
                    Change your contact email
                  </a>
                </li>
                <li>
                  <a className={frame.link} href="/messages">
                    Message Centre
                  </a>
                  {unread !== undefined && unread > 0 ? (
                    <span className={frame.yellow}> ({unreadLabel(unread)})</span>
                  ) : null}
                </li>
                <li>
                  <a className={frame.link} href="/serverlist">
                    Choose a world and play
                  </a>
                </li>
                <li>
                  <a className={frame.link} href="/account/records">
                    Set a record
                  </a>
                </li>
                {/* The one link on the site that depends on what an account may
                    do, so it is decided from the profile row read on this request
                    and never from the cookie. Hiding it is only cosmetic: /staff
                    redirects, and every staff SQL function re-reads the level for
                    itself. */}
                {isStaff(profile) ? (
                  <li>
                    <a className={frame.link} href="/staff">
                      Staff inbox
                    </a>
                  </li>
                ) : null}
              </ul>

              <LogoutButton />
            </div>
          </Panel>
        </div>

        <div className={styles.column}>
          <Panel>
            <div className={styles.form}>
              <div className={styles.heading}>
                <b>Your Adventurer</b>
              </div>
              <div className={styles.adventurer}>
                <ChatheadFace
                  look={look ?? null}
                  size={72}
                  label={`${toDisplayName(profile.username)}'s chathead`}
                  className={styles.face}
                />
                <ul className={styles.links}>
                  <li>
                    <a
                      className={frame.link}
                      href={logHref(profile.username)}
                    >
                      Your Adventurer Log
                    </a>
                  </li>
                  <li>
                    <a className={frame.link} href="/account/adventurer-log">
                      Edit your log
                    </a>
                  </li>
                  <li>
                    <a className={frame.link} href="/account/adventurer-log/character">
                      Your character
                    </a>
                  </li>
                  <li>
                    <a className={frame.link} href="/account/adventurer-log/outfits">
                      Outfits and your chathead
                    </a>
                  </li>
                  <li>
                    <a className={frame.link} href={DIRECTORY_HREF}>
                      Other players&rsquo; logs
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
