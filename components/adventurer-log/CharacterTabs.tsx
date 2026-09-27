import { CHARACTER_HREF, SHEET_HREF, WORDS_HREF } from "@/lib/adventurer-log/href";

import styles from "./Character.module.css";

const TABS = [
  { key: "look", href: CHARACTER_HREF, text: "Look" },
  { key: "words", href: WORDS_HREF, text: "Words" },
  { key: "sheet", href: SHEET_HREF, text: "Sheet" },
] as const;

/**
 * Character's three tabs, over the panel beside the card: Look (outfits,
 * where you stand, which way you face), Words (overhead chat and the
 * dialogue) and Sheet (who you are). Each is its own page, so each is plain
 * links, the site's rule; the current one is text.
 */
export default function CharacterTabs({ current }: { current: "look" | "words" | "sheet" }) {
  return (
    <nav className={styles.tabs} aria-label="Character">
      {TABS.map((tab) =>
        tab.key === current ? (
          <span key={tab.key} className={styles.tab} aria-current="page">
            {tab.text}
          </span>
        ) : (
          <a key={tab.key} className={styles.tab} href={tab.href}>
            {tab.text}
          </a>
        ),
      )}
    </nav>
  );
}
