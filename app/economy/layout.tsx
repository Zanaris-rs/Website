import type { ReactNode } from "react";

import Frame from "@/components/site/Frame";

/**
 * The chrome around all four census pages.
 *
 * Only the frame. **No `revalidate` here**: the lowest value across a layout
 * and its page wins for the whole route, so a number on this file would drag
 * `/economy/about` — which is prose, reads nothing, and should be static
 * forever — into regenerating every five minutes alongside the pages that
 * actually have a database behind them. Each page states its own.
 */
export default function EconomyLayout({ children }: { children: ReactNode }) {
  return <Frame>{children}</Frame>;
}
