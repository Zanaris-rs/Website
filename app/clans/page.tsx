import type { Metadata } from "next";

import styles from "@/components/clans/Clans.module.css";
import Crest from "@/components/clans/Crest";
import ChatText from "@/components/game/ChatText";
import frame from "@/components/site/Frame.module.css";
import Frame from "@/components/site/Frame";
import Panel from "@/components/site/Panel";
import TitleBox from "@/components/site/TitleBox";
import { formatMonth } from "@/lib/adventurer-log/format";
import { CLAN_TAB_HREF } from "@/lib/adventurer-log/href";
import { crestName } from "@/lib/clans/crests";
import { clanHref } from "@/lib/clans/href";
import { loadClanDirectory } from "@/lib/clans/page-data";
import type { ClanListing } from "@/lib/clans/queries";
import { COMMUNITY_BAR_WIDTH, communityLinks } from "@/lib/community/href";

export const metadata: Metadata = {
  title: "Clans",
  description: "Every clan on Zanaris, the largest first.",
};

export const dynamic = "force-dynamic";

/**
 * `/clans` - every clan with at least one member who isn't banned: its
 * crest, name, motto and size, the largest first, then by name, at most 200
 * (migration 17's `clan_directory`).
 */
export default async function Clans() {
  let clans: ClanListing[];
  try {
    clans = await loadClanDirectory();
  } catch (error) {
    console.error("[clans] directory read failed", error);
    return (
      <Frame>
        <TitleBox title="Clans" links={communityLinks("clans")} width={COMMUNITY_BAR_WIDTH} />
        <Panel>
          <p>Clans are unavailable right now. Try again shortly.</p>
        </Panel>
      </Frame>
    );
  }

  return (
    <Frame>
      <TitleBox title="Clans" links={communityLinks("clans")} width={COMMUNITY_BAR_WIDTH} />
      <Panel width="100%">
        {clans.length === 0 ? (
          <p className={styles.empty}>No clans yet.</p>
        ) : (
          <ul className={styles.clans}>
            {clans.map((clan) => (
              <li key={clan.slug} className={styles.clanRow}>
                <Crest id={clan.crest} size="s" label={`Crest: ${crestName(clan.crest)}`} />
                <div className={styles.clanMain}>
                  <a className={`${frame.link} ${styles.clanName}`} href={clanHref(clan.slug)}>
                    {clan.name}
                  </a>
                  {clan.motto ? (
                    <p className={styles.motto}>
                      <ChatText text={clan.motto} colour={0} effect={0} />
                    </p>
                  ) : null}
                  <p className={styles.muted}>
                    {clan.members} {clan.members === 1 ? "member" : "members"} &middot; founded{" "}
                    {formatMonth(clan.createdAt)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className={styles.hint}>
          Clans are invite-only. <a className={frame.link} href={CLAN_TAB_HREF}>Your clan</a>
        </p>
      </Panel>
    </Frame>
  );
}
