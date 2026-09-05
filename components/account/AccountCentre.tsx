import { toDisplayName } from "@/lib/base37";
import {
  type Profile,
  type RecentLogin,
  accountStatus,
  formatDay,
  formatWhen,
  presenceLine,
} from "@/lib/account/profile";
import frame from "@/components/site/Frame.module.css";
import Panel from "@/components/site/Panel";
import TitleBox from "@/components/site/TitleBox";
import { colourClass } from "@/components/site/colour";

import LogoutButton from "./LogoutButton";
import styles from "./Account.module.css";

/**
 * The account centre: what this account is, what is currently true about it,
 * where it has been logged in from, and the four things you can do to it.
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
}: {
  profile: Profile;
  logins: readonly RecentLogin[];
  /**
   * Unread messages, once Part 3's Message Centre exists. Undefined until
   * then, and the link simply carries no count — a "(0)" that could never
   * change would be worse than nothing.
   */
  unread?: number;
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
          )}

          <p className={styles.note}>
            These are your own game logins. If one of them is not you, change
            your password now — it also signs every other device out.
          </p>
        </div>
      </Panel>

      <Panel>
        <div className={styles.form}>
          <ul className={styles.links}>
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
                <span className={frame.yellow}> ({unread} unread)</span>
              ) : null}
            </li>
            <li>
              <a className={frame.link} href="/serverlist">
                Choose a world and play
              </a>
            </li>
          </ul>

          <LogoutButton />
        </div>
      </Panel>
    </>
  );
}
