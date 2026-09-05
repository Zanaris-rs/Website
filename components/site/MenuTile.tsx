import type { ReactNode } from "react";

import frame from "./Frame.module.css";
import styles from "./Site.module.css";
import StoneCaption from "./StoneCaption";
import Tile from "./Tile";

/**
 * One entry in a title-screen menu: a picture, a stone caption, a line of
 * blurb and a link.
 *
 * Two layouts, both from the original:
 *
 * - `wide` — the 77x120 picture on the left, caption and blurb on the right.
 *   Main Features and Other Features use it.
 * - `compact` — a wider caption on top, the same picture drawn small at 48x75,
 *   blurb underneath. Secure Services uses it, and its files are the same
 *   77x120 tiles: Lost City draws them at 48x75 rather than shipping a second
 *   size, and so do we.
 */
export default function MenuTile({
  href,
  image,
  caption,
  blurb,
  linkText = "Click Here",
  variant = "grey",
  layout,
}: {
  href: string;
  image: string;
  caption: ReactNode;
  blurb: ReactNode;
  linkText?: string;
  variant?: "grey" | "red";
  layout: "wide" | "compact";
}) {
  if (layout === "compact") {
    return (
      <div className={styles.tileCompact}>
        <a href={href}>
          <StoneCaption variant={variant} width={160} height={30} glow>
            {caption}
          </StoneCaption>
        </a>
        <div className={styles.tileCompactImage}>
          {/* The picture is a third link to the same place as the caption
              above it and the link below it. It carries no name of its own —
              the tile's name is the caption — so it is hidden from assistive
              technology and taken out of the tab order rather than announced
              as an unlabelled link. A mouse can still click it, which is the
              only thing it was ever for. */}
          <a href={href} aria-hidden="true" tabIndex={-1}>
            <Tile src={image} width={48} height={75} />
          </a>
        </div>
        <div className={styles.tileBlurb}>
          {blurb}
          <br />
          <a href={href} className={frame.link}>
            {linkText}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.tileWide}>
      <div className={styles.tileImage}>
        {/* Hidden from assistive technology and out of the tab order: see the
            note on the compact layout above. */}
        <a href={href} aria-hidden="true" tabIndex={-1}>
          <Tile src={image} width={77} height={120} />
        </a>
      </div>
      <div className={styles.tileBody}>
        <a href={href}>
          <StoneCaption variant={variant} width={110} height={45} glow>
            {caption}
          </StoneCaption>
        </a>
        <div className={styles.tileBlurb}>
          {blurb}
          <br />
          <a href={href} className={frame.link}>
            {linkText}
          </a>
        </div>
      </div>
    </div>
  );
}
