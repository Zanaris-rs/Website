import type { ReactNode } from "react";

import styles from "./Frame.module.css";

/**
 * The 2004 page chrome: a 600px column of edge tiles round a tiling
 * background, centred on black.
 *
 * Shared by the hiscores pages and the register page — hence `components/site/`
 * rather than living under either — because the register form is the one place
 * a new player meets the site, and it should not look like a different website
 * from the hiscores they were just reading.
 *
 * `next/image` is deliberately not used: these are exact-size 2004 tiles that
 * must not be re-encoded, resized or lazy-loaded, or the seams show.
 */
export default function Frame({ children }: { children: ReactNode }) {
  return (
    <div className={styles.page}>
      <div className={styles.column}>
        <div className={styles.edges}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/img/edge_a.jpg" width={100} height={43} alt="" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/img/edge_c.jpg" width={400} height={42} alt="" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/img/edge_d.jpg" width={100} height={43} alt="" />
        </div>

        <div className={styles.body}>{children}</div>

        <div className={styles.footer}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/img/edge_g2.jpg" width={100} height={82} alt="" />
          <div className={styles.footerMiddle}>
            <div className={styles.disclaimer}>
              Zanaris is a free, fan-run preservation project. It is not
              affiliated with, endorsed by or connected to Jagex Ltd.
              <br />
              RuneScape is a trademark of Jagex Ltd.
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/img/edge_c.jpg" width={400} height={42} alt="" />
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/img/edge_h2.jpg" width={100} height={82} alt="" />
        </div>
      </div>
    </div>
  );
}
