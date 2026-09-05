import type { ReactNode } from "react";

import frame from "./Frame.module.css";
import styles from "./Site.module.css";

/**
 * The 500px black panel with the thin brown border that holds a page's prose:
 * `<table width=500 bgcolor=black cellpadding=4><td class=e>` in the original.
 *
 * `align="left"` is the variant used for anything with paragraphs in it; the
 * default centres, which is what short blocks and tables want.
 */
export default function Panel({
  children,
  align = "center",
  width = 500,
}: {
  children: ReactNode;
  align?: "center" | "left";
  width?: number;
}) {
  return (
    <div className={styles.panelBox} style={{ width }}>
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
