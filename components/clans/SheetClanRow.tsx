import { CLAN_TAB_HREF } from "@/lib/adventurer-log/href";
import type { ClanOf } from "@/lib/clans/queries";
import { RANK_NAMES } from "@/lib/clans/ranks";

import styles from "./Clans.module.css";
import RankIcon from "./RankIcon";

/** What the Sheet knows of its owner's clan: theirs, none, or a read that failed. */
export type SheetClan = ClanOf | null | "unavailable";

/**
 * The value of the Sheet tab's Clan row: the rank icon, the clan's name and
 * the rank, or "Not in a clan". It is read-only and saves nothing: a clan is
 * joined, left and ranked on the Clan tab, which it links to. When the read
 * failed it says so, rather than inviting a member to start a clan. The
 * Sheet draws the row and its "Clan" label, as it does its other rows, and
 * passes its own `className` for the value.
 */
export default function SheetClanRow({ clan, className }: { clan: SheetClan; className?: string }) {
  return (
    <span className={className}>
      {clan === "unavailable" ? (
        "Unavailable just now"
      ) : clan ? (
        <>
          <RankIcon rank={clan.rank} className={styles.rankIcon} /> <a href={CLAN_TAB_HREF}>{clan.name}</a> &middot;{" "}
          {RANK_NAMES[clan.rank]}
        </>
      ) : (
        <>
          Not in a clan &middot; <a href={CLAN_TAB_HREF}>Start or join one</a>
        </>
      )}
    </span>
  );
}
