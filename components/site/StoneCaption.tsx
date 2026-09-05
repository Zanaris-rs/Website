import type { ReactNode } from "react";

import frame from "./Frame.module.css";
import styles from "./Site.module.css";

/**
 * A label on a stone bezel: the caption above every menu tile, and the face of
 * every stone button.
 *
 * `variant` picks the grey stone (`.b` over `stoneback.gif`) or the red one
 * (`.b2` over `shinystonered.jpg`) the original keeps for the two actions it
 * most wants you to take. `glow` lights the stone on hover, which only makes
 * sense when something above it is a link.
 */
export default function StoneCaption({
  variant,
  width = 100,
  height = 45,
  glow = false,
  children,
}: {
  variant: "grey" | "red";
  width?: number;
  height?: number;
  glow?: boolean;
  children: ReactNode;
}) {
  const stone = variant === "red" ? frame.stoneRed : frame.stone;

  return (
    <span className={styles.caption} style={{ width }}>
      <span
        className={`${stone} ${styles.captionInner} ${glow ? frame.glow : ""}`}
        // A minimum rather than a fixed height: the 2004 captions are one or
        // two words, ours run to "Create Account (New User)", and a caption
        // that clips its own label is worse than one a few pixels tall. The
        // 4px is the black surround this box sits in.
        style={{ minHeight: height - 4 }}
      >
        {children}
      </span>
    </span>
  );
}
