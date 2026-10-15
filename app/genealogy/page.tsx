import type { Metadata } from "next";
import type { CSSProperties } from "react";

import account from "@/components/account/Account.module.css";
import styles from "@/components/invite/Genealogy.module.css";
import GenealogyTree from "@/components/invite/GenealogyTree";
import Frame from "@/components/site/Frame";
import TitleBox from "@/components/site/TitleBox";
import { logHref } from "@/lib/adventurer-log/href";
import type { Look } from "@/lib/chathead/look";
import { COMMUNITY_BAR_WIDTH, communityLinks } from "@/lib/community/href";
import { query } from "@/lib/db";
import { DEFAULT_PROFILE } from "@/lib/hiscores/params";
import { totalLevelsQuery } from "@/lib/hiscores/queries";
import { type GenealogyNode, buildGenealogy } from "@/lib/invite/genealogy";
import {
  type GenealogyRow,
  parseGenealogyRow,
  publicInviteGenealogyStatement,
} from "@/lib/invite/queries";
import { chatheadLooks } from "@/lib/outfits/looks";
import { DEFAULT_LOOKS_MAX } from "@/lib/outfits/queries";
import { SITE_NAME } from "@/lib/site";
import { titleTileSrc } from "@/lib/title/tiles";

export const metadata: Metadata = {
  title: "Genealogy",
  description: `Who let whom into ${SITE_NAME}, from the first citizens down.`,
};

/**
 * A minute, like the economy pages' five but shorter: the page asks the
 * database three things (the tree, every face, every total) and is the same
 * for everyone, so per request it repeated them for every visitor. A new
 * citizen, outfit or level shows within the minute. A failed read renders the
 * "unavailable" scroll, which is likewise kept for at most a minute.
 */
export const revalidate = 60;

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
/**
 * Everyone's total level, as the hiscores have it. Also a nicety: a failed
 * read is logged and the names go without.
 */
async function totalsOf(usernames: readonly string[]): Promise<Map<string, number>> {
  try {
    const wanted = totalLevelsQuery(DEFAULT_PROFILE, usernames);
    const rows = await query<{ username: string; level: number }>(wanted.text, wanted.values);
    return new Map(rows.map((row) => [row.username, Number(row.level)]));
  } catch (error) {
    console.error("[genealogy] total levels read failed", error);
    return new Map();
  }
}

export default async function GenealogyPage() {
  let rows: GenealogyRow[] = [];
  let tree: GenealogyNode[] = [];
  let looks = new Map<string, Look>();
  let totals = new Map<string, number>();
  let error: string | null = null;

  try {
    const wanted = publicInviteGenealogyStatement();
    const raw = await query<Record<string, unknown>>(wanted.text, wanted.values);
    rows = raw.map(parseGenealogyRow).filter((row): row is GenealogyRow => row !== null);
    tree = buildGenealogy(rows);
    const usernames = rows.map((row) => row.username);
    [looks, totals] = await Promise.all([looksOf(usernames), totalsOf(usernames)]);
  } catch (readError) {
    console.error("[genealogy] read failed", readError);
    error = "The invite records are unavailable right now. Try again shortly.";
  }

  return (
    <Frame>
      <TitleBox title="Genealogy" links={communityLinks(null)} width={COMMUNITY_BAR_WIDTH} />

      <div
        className={styles.scroll}
        style={{ "--scroll": `url(${titleTileSrc("quest-scroll")})` } as CSSProperties}
      >
        <div className={styles.scrollTitle}>The Lineage of {SITE_NAME}</div>

        {error ? (
          <p className={account.error} role="alert">
            {error}
          </p>
        ) : (
          <>
            <p className={styles.scrollNote}>
              No adventurer finds {SITE_NAME} alone. The Founders were here first, and head
              this scroll; every adventurer since was shown the way by one already inside,
              and stands beneath them. So far, {rows.length}{" "}
              {rows.length === 1 ? "adventurer has" : "adventurers have"} found the way.
              Click a name to read their Adventurer Log.
            </p>

            <div className={account.scroller}>
              <GenealogyTree tree={tree} href={logOf} staff={false} looks={looks} totals={totals} />
            </div>
          </>
        )}
      </div>
    </Frame>
  );
}
