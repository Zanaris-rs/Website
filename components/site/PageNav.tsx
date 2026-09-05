import type { ReactNode } from "react";

import frame from "./Frame.module.css";
import styles from "./Site.module.css";
import Tile from "./Tile";

/**
 * The news pages' navigation: a stone arrow, a gap, the title box, a gap, the
 * other stone arrow. A missing `href` leaves the slot empty rather than
 * collapsing it, so the title box stays put between pages.
 */
export default function PageNav({
  prevHref,
  nextHref,
  children,
}: {
  prevHref?: string;
  nextHref?: string;
  children: ReactNode;
}) {
  return (
    <div className={styles.pageNav}>
      <div className={styles.navSlot}>
        {prevHref ? (
          <a
            href={prevHref}
            className={`${frame.stone} ${styles.navButton}`}
            aria-label="Newer"
          >
            <Tile src="/img/prevpage.gif" width={74} height={35} />
          </a>
        ) : null}
      </div>

      <div className={styles.navCenter}>{children}</div>

      <div className={styles.navSlot}>
        {nextHref ? (
          <a
            href={nextHref}
            className={`${frame.stone} ${styles.navButton}`}
            aria-label="Older"
          >
            <Tile src="/img/nextpage.gif" width={74} height={35} />
          </a>
        ) : null}
      </div>
    </div>
  );
}
