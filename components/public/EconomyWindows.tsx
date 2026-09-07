import frame from "@/components/site/Frame.module.css";
import { economyHref } from "@/lib/public/format";
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
 */
export default function EconomyWindows({ current }: { current: EconomyWindow }) {
  return (
    <nav className={styles.tabs} aria-label="Census window">
      {ECONOMY_WINDOWS.map((window) =>
        window.slug === current.slug ? (
          <span key={window.slug} className={styles.tabCurrent} aria-current="page">
            {window.short}
          </span>
        ) : (
          <a key={window.slug} href={economyHref(window)} className={frame.link}>
            {window.short}
          </a>
        ),
      )}
    </nav>
  );
}
