import type { ReactNode } from "react";

import { PRESERVED_LINE } from "@/lib/site";

import styles from "./Frame.module.css";
import Tile from "./Tile";

/**
 * The 2004 page chrome, made fluid: chains along the top and bottom, a chain
 * down each side, cobbles behind everything, centred on black. Every page on
 * the site is inside one. The column is as wide as the screen up to
 * `--frame-max` (960px), and the pieces that used to be one 600px table
 * sandwich are now: two fixed corner tiles and a repeating chain strip between
 * them, top and bottom; and a body whose side chains are two strips cropped
 * out of the original background (they are baked into its edges) over a
 * plain cobble fill.
 *
 * The links here are plain `<a>` elements and must stay that way. `/worldmap`
 * loads `public/js/mapview.js`, which reaches for `document.getElementById`
 * the moment it is evaluated; a `next/link` client-side navigation would hand
 * it a document whose canvas is not there yet. A full page load is also what
 * the original did, so nothing is lost.
 *
 * The corner tiles keep the original's *declared* sizes, not the images'
 * natural ones (the two footer tiles are 100x77 drawn at 100x82). Those
 * declared sizes are what produced the 2004 geometry.
 */
export default function Frame({
  children,
  disclaimerLink = true,
}: {
  children: ReactNode;
  /** `/` is the disclaimer, so it does not link to itself. */
  disclaimerLink?: boolean;
}) {
  return (
    <div className={styles.page}>
      <div className={styles.column}>
        <div className={styles.edges}>
          <Tile src="/img/edge_a.jpg" width={100} height={43} />
          <div className={styles.chainStrip} />
          <Tile src="/img/edge_d.jpg" width={100} height={43} />
        </div>

        <div className={styles.body}>
          <div className={styles.cobble} aria-hidden="true" />
          <div className={styles.content}>{children}</div>
        </div>

        <div className={styles.footer}>
          <Tile
            src="/img/edge_g2.jpg"
            width={100}
            height={82}
            className={styles.footerLeft}
          />
          <div className={styles.disclaimer}>
            {disclaimerLink ? (
              <>
                <a href="/disclaimer">
                  View our non-affiliation disclaimer here.
                </a>
                <br />
              </>
            ) : null}
            {PRESERVED_LINE}
          </div>
          <div className={`${styles.chainStrip} ${styles.footerStrip}`} />
          <Tile
            src="/img/edge_h2.jpg"
            width={100}
            height={82}
            className={styles.footerRight}
          />
        </div>
      </div>
    </div>
  );
}
