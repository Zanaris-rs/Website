import frame from "@/components/site/Frame.module.css";
import { economyHref } from "@/lib/public/sections";
import { ECONOMY_WINDOWS, type EconomyWindow } from "@/lib/public/queries";

import styles from "./Public.module.css";

/**
 * How far back the page is reading.
 *
 * Plain anchors, server-rendered, like every other link in the chrome: each
 * window is its own URL with its own five-minute cache, so switching windows is
 * a navigation and not a state change, and the page needs no JavaScript to have
 * four of them. `StoneButton` is deliberately not used — four stones do not fit
 * across a 500px panel, and this is a data page rather than a menu.
 *
 * The current window renders as text with `aria-current`, not as a link to the
 * page you are already on.
 *
 * The tabs stay inside their section: on `/economy/rares` they point at
 * `/economy/rares/7-days`, not back to the overview. `economyHref` owns that,
 * and owns dropping the default window's slug so each section has one URL for
 * it rather than two.
 */
export default function EconomyWindows({
  current,
  section = "overview",
}: {
  current: EconomyWindow;
  /** Which section's tabs these are: they stay inside it. */
  section?: string;
}) {
  return (
    <nav className={styles.tabs} aria-label="Census window">
      {ECONOMY_WINDOWS.map((window) =>
        window.slug === current.slug ? (
          <span key={window.slug} className={styles.tabCurrent} aria-current="page">
            {window.short}
          </span>
        ) : (
          <a key={window.slug} href={economyHref(window, section)} className={frame.link}>
            {window.short}
          </a>
        ),
      )}
    </nav>
  );
}
