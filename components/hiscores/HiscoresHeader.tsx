"use client";

import { useRouter, useSearchParams } from "next/navigation";

import TitleBox from "@/components/site/TitleBox";
import { COMMUNITY_BAR_WIDTH, communityLinks } from "@/lib/community/href";
import { PROFILES } from "@/lib/hiscores/params";

import styles from "./Hiscores.module.css";

/**
 * The top of the hiscores table: the site's title box with the community
 * bar in it, Hiscores the page you are on, then the profile picker. The
 * record board, a hiscores page of its own (`/hiscores/records`), is in the
 * bar too. One player's hiscores are their Adventurer Log's Skills box now
 * (`/hiscores/player/<name>` redirects there).
 */
export default function HiscoresHeader() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const profile = searchParams.get("profile") ?? PROFILES[0].id;

  // Changing the profile keeps every other parameter, so a player looking at
  // rank 500 of Mining stays at rank 500 of Mining.
  function onProfileChange(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("profile", next);
    router.push(`?${params.toString()}`);
  }

  return (
    <>
      <TitleBox title="Zanaris Hiscores" links={communityLinks("hiscores")} width={COMMUNITY_BAR_WIDTH} />

      <form className={styles.profileForm} method="GET">
        <select
          className={styles.profileSelect}
          name="profile"
          value={profile}
          onChange={(event) => onProfileChange(event.target.value)}
          aria-label="Profile"
        >
          {PROFILES.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
      </form>
    </>
  );
}
