import type { ReactNode } from "react";

import styles from "./Site.module.css";

/**
 * The stone-bordered block the title screen is made of: Latest News, Main
 * Features, Account Services, Game Rules & Resources.
 *
 * The original draws it with eleven GIFs in nested tables; this is the same
 * eleven GIFs as a nine-cell CSS grid — 6px corners, 18x6 edge tiles repeated
 * across the top and bottom, 6x25 tiles repeated down the sides, black in the
 * middle. It is 500px wide when the frame allows and the frame's width when it
 * does not; `className` (the title screen passes `sectionPanel`) or `width`
 * overrides that.
 */
export default function StonePanel({
  title,
  children,
  width,
  className,
}: {
  title?: string;
  children: ReactNode;
  width?: number | string;
  className?: string;
}) {
  return (
    <div
      className={className ? `${styles.stonePanel} ${className}` : styles.stonePanel}
      style={width === undefined ? undefined : { width }}
    >
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
