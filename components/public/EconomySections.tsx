import frame from "@/components/site/Frame.module.css";
import TitleBox from "@/components/site/TitleBox";
import { ECONOMY_SECTIONS, economyHref } from "@/lib/public/sections";
import type { EconomyWindow } from "@/lib/public/queries";

import styles from "./Public.module.css";

/**
 * The census's own nav: the four pages it is made of, across the top of each.
 *
 * It belongs to the title box rather than sitting somewhere below it: the only
 * links above a transparency page used to go *out* — the main menu, the ban
 * record — leaving a reader nowhere to go but away. These go across. Somebody
 * who has just read that staff have created nothing should be one click from
 * how that is counted and one from what the count cannot prove.
 *
 * Every link is the same width so they read as one row of four rather than as
 * four things of different sizes; the widest label sets it.
 *
 * `EconomyWindows`'s rules, for `EconomyWindows`'s reasons: plain anchors, each
 * section its own URL and its own cache, and the page you are on rendered as
 * text with `aria-current` rather than as a link to itself.
 *
 * The window rides along. A reader looking at ninety days who clicks through to
 * the rares should still be looking at ninety days, and `economyHref` drops it
 * again for the two sections that have no window to keep.
 */
export default function EconomySections({
  current,
  window,
}: {
  /** The `key` of the section being rendered. */
  current: string;
  window: EconomyWindow;
}) {
  return (
    <>
      <TitleBox title="The Economy" />
      <nav className={styles.sections} aria-label="The economy">
        {ECONOMY_SECTIONS.map((section) =>
          section.key === current ? (
            <span
              key={section.key}
              className={styles.sectionCurrent}
              aria-current="page"
            >
              {section.label}
            </span>
          ) : (
            <a
              key={section.key}
              href={economyHref(window, section.key)}
              className={frame.link}
            >
              {section.label}
            </a>
          ),
        )}
      </nav>
    </>
  );
}
