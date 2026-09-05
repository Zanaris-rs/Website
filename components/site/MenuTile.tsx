import type { ReactNode } from "react";

import frame from "./Frame.module.css";
import styles from "./Site.module.css";
import StoneCaption from "./StoneCaption";
import Tile from "./Tile";

/**
 * One entry in a title-screen menu: a picture, a stone caption, a line of
 * blurb and a link.
 *
 * One markup tree, two layouts, both from the original and both decided by
 * `Site.module.css`: on a phone the caption sits on top, the 77x120 picture
 * is drawn small at 48x75 beneath it and the blurb under that (Lost City's
 * "Secure Services" look); from 900px the picture is on the left at full size
 * with the caption and blurb beside it (the "Main Features" look).
 *
 * `image` is optional. A tile without one — the LostHQ wiki, which has no
 * 2004 picture to borrow — is just its caption and blurb.
 */
export default function MenuTile({
  href,
  image,
  caption,
  blurb,
  linkText = "Click Here",
  variant = "grey",
}: {
  href: string;
  image?: string;
  caption: ReactNode;
  blurb: ReactNode;
  linkText?: string;
  variant?: "grey" | "red";
}) {
  return (
    <div className={`${styles.tile} ${image ? "" : styles.tileNoPicture}`}>
      {image ? (
        <div className={styles.tileImage}>
          {/* The picture is a third link to the same place as the caption and
              the link below it. It carries no name of its own — the tile's
              name is the caption — so it is hidden from assistive technology
              and taken out of the tab order rather than announced as an
              unlabelled link. A mouse can still click it, which is the only
              thing it was ever for. */}
          <a href={href} aria-hidden="true" tabIndex={-1}>
            <Tile
              src={image}
              width={77}
              height={120}
              className={styles.tilePicture}
            />
          </a>
        </div>
      ) : null}
      <div className={styles.tileBody}>
        <a href={href} className={styles.tileCaption}>
          <StoneCaption variant={variant} glow>
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
