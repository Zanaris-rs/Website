import type { ReactNode } from "react";

import frame from "./Frame.module.css";
import styles from "./Site.module.css";

/**
 * The black panel with the thin border that holds a page's prose:
 * `<table width=500 bgcolor=black cellpadding=4><td class=e>` in the original.
 * It is 500px wide when the frame allows and the frame's width when it does
 * not; a `width` overrides that. The padding inside it is roomier than the
 * original's 4px cell padding, so text does not run up against the border.
 *
 * `align="left"` is the variant used for anything with paragraphs in it; the
 * default centres, which is what short blocks and tables want. `className`
 * lands on the bordered box itself, for a page that recolours it (the
 * disclaimer).
 */
export default function Panel({
  children,
  align = "center",
  width,
  className,
}: {
  children: ReactNode;
  align?: "center" | "left";
  width?: number | string;
  className?: string;
}) {
  return (
    <div
      className={styles.panelBox}
      style={width === undefined ? undefined : { width }}
    >
      <div
        className={[
          frame.panel,
          styles.panelInner,
          align === "left" ? styles.panelLeft : styles.panelCenter,
          className,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {children}
      </div>
    </div>
  );
}
