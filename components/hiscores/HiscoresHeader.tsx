"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { PROFILES } from "@/lib/hiscores/params";
import { BOARD_PATH } from "@/lib/records/api";

import frame from "@/components/site/Frame.module.css";

import styles from "./Hiscores.module.css";

/**
 * The box at the top of every hiscores screen, plus the profile picker.
 *
 * Shared by the table and the personal page so the two cannot drift; the only
 * difference between them is the extra "All Hiscores" link, which the personal
 * page needs and the table does not. Both link to the record board, which is
 * a hiscores page of its own (`/hiscores/records`).
 */
export default function HiscoresHeader({
  showAllLink = false,
}: {
  showAllLink?: boolean;
}) {
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
      <div className={styles.spacer} />
      <div className={`${frame.panel} ${styles.header}`}>
        <b>Zanaris Hiscores</b>
        <br />
        <a className={frame.link} href="/title">
          Main menu
        </a>
        {showAllLink && (
          <>
            {" - "}
            <a className={frame.link} href="/hiscores">
              All Hiscores
            </a>
          </>
        )}
        {" - "}
        <a className={frame.link} href={BOARD_PATH}>
          Records
        </a>
      </div>
      <div className={styles.spacer} />

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
