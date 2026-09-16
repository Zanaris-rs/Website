import account from "@/components/account/Account.module.css";
import frame from "@/components/site/Frame.module.css";
import Panel from "@/components/site/Panel";
import TitleBox from "@/components/site/TitleBox";
import { formatWhen } from "@/lib/account/profile";
import { toDisplayName } from "@/lib/base37";
import { formatCitizen } from "@/lib/invite/format";
import type { InviterRow, TreeRow } from "@/lib/invite/queries";
import { staffLinks } from "@/lib/staff/links";

import StaffInviteToggle from "./StaffInviteToggle";

/**
 * "Who may let people in, and who let this player in?"
 *
 * Inviting is off for every account until somebody switches it on here (or
 * with `npm run account -- invite-enable`), so the list of accounts that have
 * it is the whole of the growth of the server, and it is on this page.
 *
 * The tree is one level each way: who invited the player, and who they have
 * invited. A banned account's invitees are the first place to look for its
 * next account.
 */

const RELATION: Record<TreeRow["relation"], string> = {
  self: "This account",
  invited_by: "Invited them",
  invited: "They invited",
};

function playerLink(username: string) {
  return (
    <a className={frame.link} href={`/staff/invites?username=${encodeURIComponent(username)}`}>
      {toDisplayName(username)}
    </a>
  );
}

export default function StaffInvites({
  username,
  tree,
  inviters,
  error,
}: {
  username: string;
  tree: readonly TreeRow[];
  inviters: readonly InviterRow[];
  error: string | null;
}) {
  const self = tree.find((row) => row.relation === "self") ?? null;

  return (
    <>
      <TitleBox title="Invites" links={staffLinks("/staff/invites")} />

      <Panel align="left">
        <div className={account.heading}>
          <b>Look up a player</b>
        </div>

        <form method="get" action="/staff/invites" className={account.form}>
          <div className={account.fields}>
            <label htmlFor="invites-username">Player:</label>
            <input
              id="invites-username"
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
              Look up
            </button>
          </div>
        </form>

        {error ? (
          <p className={account.error} role="alert">
            {error}
          </p>
        ) : null}

        {username && !error && !self ? (
          <p className={account.note}>There is no account called {username}.</p>
        ) : null}

        {self ? (
          <>
            <div className={account.scroller}>
              <table className={account.logins}>
                <thead>
                  <tr>
                    <th />
                    <th>Player</th>
                    <th>Citizen</th>
                    <th>When</th>
                    <th>Inviting</th>
                  </tr>
                </thead>
                <tbody>
                  {tree.map((row) => (
                    <tr key={`${row.relation}-${row.citizenNumber}`}>
                      <td>{RELATION[row.relation]}</td>
                      <td>
                        {playerLink(row.username)}
                        {row.banned ? " (banned)" : ""}
                      </td>
                      <td>{formatCitizen(row.citizenNumber)}</td>
                      <td>{formatWhen(row.happenedAt)}</td>
                      <td>{row.invitesEnabled ? "on" : "off"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <StaffInviteToggle username={self.username} enabled={self.invitesEnabled} />
          </>
        ) : null}
      </Panel>

      <Panel align="left">
        <div className={account.heading}>
          <b>Accounts that can invite ({inviters.length})</b>
        </div>

        {inviters.length === 0 ? (
          <p className={account.note}>
            Nobody can invite yet. Look a player up above and switch it on.
          </p>
        ) : (
          <div className={account.scroller}>
            <table className={account.logins}>
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Citizen</th>
                  <th>Unused links</th>
                  <th>Brought in</th>
                </tr>
              </thead>
              <tbody>
                {inviters.map((row) => (
                  <tr key={row.citizenNumber}>
                    <td>
                      {playerLink(row.username)}
                      {row.banned ? " (banned)" : ""}
                    </td>
                    <td>{formatCitizen(row.citizenNumber)}</td>
                    <td>{row.liveLinks}</td>
                    <td>{row.claimedLinks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
