import account from "@/components/account/Account.module.css";
import frame from "@/components/site/Frame.module.css";
import Panel from "@/components/site/Panel";
import TitleBox from "@/components/site/TitleBox";
import { formatWhen } from "@/lib/account/profile";
import { toDisplayName } from "@/lib/base37";
import { formatCitizen } from "@/lib/invite/format";
import type { GenealogyNode } from "@/lib/invite/genealogy";
import { staffLinks } from "@/lib/staff/links";

import styles from "./Genealogy.module.css";

/**
 * The server tree: every account, under the account that let it in, with the
 * progenitors - the accounts nobody invited - at the top.
 *
 * A branch with children is a `<details>`, open to start with, so a large line
 * can be folded away without any script. Each name goes to that player on
 * `/staff/invites`, where inviting is switched on and off.
 */

function Person({ node }: { node: GenealogyNode }) {
  const title = `Joined ${formatWhen(node.joinedAt)}`;
  return (
    <span className={styles.person} title={title}>
      <a
        className={`${frame.link} ${node.banned ? styles.banned : ""}`}
        href={`/staff/invites?username=${encodeURIComponent(node.username)}`}
      >
        {toDisplayName(node.username)}
      </a>{" "}
      <span className={styles.citizen}>{formatCitizen(node.citizenNumber)}</span>
      {node.banned ? <span className={styles.bannedTag}> banned</span> : null}
      {node.invitesEnabled ? <span className={styles.inviter}> can invite</span> : null}
      {node.descendants > 0 ? (
        <span className={styles.count}>
          {" "}
          · {node.descendants} below
        </span>
      ) : null}
    </span>
  );
}

function Branch({ node }: { node: GenealogyNode }) {
  if (node.children.length === 0) {
    return (
      <li>
        <div className={styles.leaf}>
          <Person node={node} />
        </div>
      </li>
    );
  }
  return (
    <li>
      <details open className={styles.branch}>
        <summary>
          <Person node={node} />
        </summary>
        <ul>
          {node.children.map((child) => (
            <Branch key={child.citizenNumber} node={child} />
          ))}
        </ul>
      </details>
    </li>
  );
}

export default function StaffGenealogy({
  tree,
  accounts,
  error,
}: {
  tree: readonly GenealogyNode[];
  accounts: number;
  error: string | null;
}) {
  return (
    <>
      <TitleBox title="Genealogy" links={staffLinks("/staff/invites/genealogy")} />

      <Panel align="left">
        <div className={account.heading}>
          <b>The server tree</b>
        </div>

        {error ? (
          <p className={account.error} role="alert">
            {error}
          </p>
        ) : (
          <>
            <p className={account.note}>
              {accounts} {accounts === 1 ? "account" : "accounts"}, {tree.length}{" "}
              {tree.length === 1 ? "progenitor" : "progenitors"}. A progenitor is an
              account nobody invited. Everyone else sits under the player whose link
              they used. Click a name to open that player on the Invites page.
            </p>

            <div className={account.scroller}>
              <ul className={styles.tree}>
                {tree.map((node) => (
                  <Branch key={node.citizenNumber} node={node} />
                ))}
              </ul>
            </div>
          </>
        )}
      </Panel>
    </>
  );
}
