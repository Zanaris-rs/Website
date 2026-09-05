import type { ReactNode } from "react";

import frame from "./Frame.module.css";
import styles from "./Site.module.css";

/**
 * The black panel with the thin border that holds a page's prose:
 * `<table width=500 bgcolor=black cellpadding=4><td class=e>` in the original.
 * It is 500px wide when the frame allows and the frame's width when it does
 * not; a `width` overrides that.
 *
 * `align="left"` is the variant used for anything with paragraphs in it; the
 * default centres, which is what short blocks and tables want.
 */
export default function Panel({
  children,
  align = "center",
  width,
}: {
  children: ReactNode;
  align?: "center" | "left";
  width?: number | string;
}) {
  return (
    <div
      className={styles.panelBox}
      style={width === undefined ? undefined : { width }}
    >
      <div
        className={`${frame.panel} ${
          align === "left" ? styles.panelLeft : styles.panelCenter
        }`}
      >
        {children}
      </div>
    </div>
  );
}
