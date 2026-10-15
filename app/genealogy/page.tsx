import type { Metadata } from "next";

import account from "@/components/account/Account.module.css";
import GenealogyTree from "@/components/invite/GenealogyTree";
import Frame from "@/components/site/Frame";
import Panel from "@/components/site/Panel";
import TitleBox from "@/components/site/TitleBox";
import { logHref } from "@/lib/adventurer-log/href";
import type { Look } from "@/lib/chathead/look";
import { COMMUNITY_BAR_WIDTH, communityLinks } from "@/lib/community/href";
import { query } from "@/lib/db";
import { type GenealogyNode, buildGenealogy } from "@/lib/invite/genealogy";
import {
  type GenealogyRow,
  parseGenealogyRow,
  publicInviteGenealogyStatement,
} from "@/lib/invite/queries";
import { chatheadLooks } from "@/lib/outfits/looks";
import { DEFAULT_LOOKS_MAX } from "@/lib/outfits/queries";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "Genealogy",
  description: `Who let whom into ${SITE_NAME}, from the first citizens down.`,
};

export const dynamic = "force-dynamic";

const logOf = (node: GenealogyNode) => logHref(node.username);

/**
 * Everyone's chathead, a hundred names a statement (`DEFAULT_LOOKS_MAX`). A
 * nicety: a failed read is logged and every face falls back to the default.
 */
async function looksOf(usernames: readonly string[]): Promise<Map<string, Look>> {
  const batches: string[][] = [];
  for (let i = 0; i < usernames.length; i += DEFAULT_LOOKS_MAX) {
    batches.push(usernames.slice(i, i + DEFAULT_LOOKS_MAX));
  }
  try {
    return new Map((await Promise.all(batches.map(chatheadLooks))).flatMap((looks) => [...looks]));
  } catch (error) {
    console.error("[genealogy] chatheads read failed", error);
    return new Map();
  }
}

/**
 * `/genealogy`: the whole invite tree, for everyone. Every account sits under
 * the player whose link it used; each name opens that player's Adventurer
 * Log. Public since migration 19: the staff tree (`/staff/invites/genealogy`)
 * keeps the staff tags.
 */
export default async function GenealogyPage() {
  let rows: GenealogyRow[] = [];
  let tree: GenealogyNode[] = [];
  let looks = new Map<string, Look>();
  let error: string | null = null;

  try {
    const wanted = publicInviteGenealogyStatement();
    const raw = await query<Record<string, unknown>>(wanted.text, wanted.values);
    rows = raw.map(parseGenealogyRow).filter((row): row is GenealogyRow => row !== null);
    tree = buildGenealogy(rows);
    looks = await looksOf(rows.map((row) => row.username));
  } catch (readError) {
    console.error("[genealogy] read failed", readError);
    error = "The invite records are unavailable right now. Try again shortly.";
  }

  return (
    <Frame>
      <TitleBox title="Genealogy" links={communityLinks(null)} width={COMMUNITY_BAR_WIDTH} />

      <Panel align="left">
        <div className={account.heading}>
          <b>Who let whom in</b>
        </div>

        {error ? (
          <p className={account.error} role="alert">
            {error}
          </p>
        ) : (
          <>
            <p className={account.note}>
              Every one of the {rows.length} {rows.length === 1 ? "citizen" : "citizens"} of{" "}
              {SITE_NAME} was let in by somebody who already plays. The first citizens are at
              the top; everyone else sits under the player whose invite they used. Click a
              name to read their Adventurer Log.
            </p>

            <div className={account.scroller}>
              <GenealogyTree tree={tree} href={logOf} staff={false} looks={looks} />
            </div>
          </>
        )}
      </Panel>
    </Frame>
  );
}
