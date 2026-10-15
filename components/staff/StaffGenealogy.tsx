import account from "@/components/account/Account.module.css";
import GenealogyTree from "@/components/invite/GenealogyTree";
import Panel from "@/components/site/Panel";
import TitleBox from "@/components/site/TitleBox";
import type { GenealogyNode } from "@/lib/invite/genealogy";
import { staffLinks } from "@/lib/staff/links";

/**
 * The server tree, for staff: the public tree (`GenealogyTree`) with the staff
 * tags, and each name going to that player on `/staff/invites`, where inviting
 * is switched on and off.
 */
const staffHref = (node: GenealogyNode) => `/staff/invites?username=${encodeURIComponent(node.username)}`;

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
              <GenealogyTree tree={tree} href={staffHref} staff />
            </div>
          </>
        )}
      </Panel>
    </>
  );
}
