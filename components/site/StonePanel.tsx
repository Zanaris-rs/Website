import type { ReactNode } from "react";

import styles from "./Site.module.css";

/**
 * The stone-bordered block the title screen is made of: Latest News, Main
 * Features, Secure Services, Other Features.
 *
 * The original draws it with eleven GIFs in nested tables; this is the same
 * eleven GIFs as a nine-cell CSS grid — 6px corners, 18x6 edge tiles repeated
 * across the top and bottom, 6x25 tiles repeated down the sides, black in the
 * middle.
 */
export default function StonePanel({
  title,
  children,
  width = 500,
}: {
  title?: string;
  children: ReactNode;
  width?: number;
}) {
  return (
    <div className={styles.stonePanel} style={{ width }}>
      <div className={styles.cornerTopLeft} />
      <div className={styles.edgeTop} />
      <div className={styles.cornerTopRight} />

      <div className={styles.edgeLeft} />
      <div className={styles.stoneInterior}>
        {title ? <div className={styles.stoneTitle}>{title}</div> : null}
        {children}
      </div>
      <div className={styles.edgeRight} />

      <div className={styles.cornerBottomLeft} />
      <div className={styles.edgeBottom} />
      <div className={styles.cornerBottomRight} />
    </div>
  );
}
