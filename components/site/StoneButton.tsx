import type { ReactNode } from "react";

import StoneCaption from "./StoneCaption";

/**
 * A stone caption you can click: the disclaimer's **I Understand** and
 * **Source Code**, and anything else that wants to look like a 2004 button.
 *
 * A plain `<a>`, never `next/link` — see the note in `Frame.tsx`.
 */
export default function StoneButton({
  href,
  variant,
  children,
  width = 140,
  height = 45,
}: {
  href: string;
  variant: "grey" | "red";
  children: ReactNode;
  width?: number;
  height?: number;
}) {
  return (
    <a href={href}>
      <StoneCaption variant={variant} width={width} height={height} glow>
        {children}
      </StoneCaption>
    </a>
  );
}
