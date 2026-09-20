import type { ReactNode } from "react";

import styles from "@/components/public/Public.module.css";
import Frame from "@/components/site/Frame";

/**
 * The chrome around all four census pages, and the one place their width is
 * decided.
 *
 * `.stack` redefines `--panel-max`, which `Site.module.css` reads for every
 * `Panel` on the site — so every panel inside the census is the same width as
 * the one holding the charts, and not one of them has to say so. It also puts
 * a gap between them: the panels used to stack flush, which made four separate
 * statements look like one long box with rules drawn across it.
 *
 * **No `revalidate` here**: the lowest value across a layout and its page wins
 * for the whole route, so a number on this file would drag every census page
 * onto the same clock. Each page states its own.
 */
export default function EconomyLayout({ children }: { children: ReactNode }) {
  return (
    <Frame>
      <div className={styles.stack}>{children}</div>
    </Frame>
  );
}
