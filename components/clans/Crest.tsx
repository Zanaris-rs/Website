import ItemIcon from "@/components/game/ItemIcon";

import styles from "./Clans.module.css";

/**
 * A clan's crest: its item's inventory icon on a heraldic shield, the icon
 * at 1x, 1.5x and 2x (`s`, `m`, `l`) with square pixels (`GameIcon` makes
 * any upscale pixelated). The shield is inline SVG, so the crest is one
 * picture file however large. `label` names it for a screen reader; the
 * item's name lives on the server (`crestName`), so callers pass it when
 * they have it.
 */

const SIZES = {
  s: { icon: 32, width: 42, height: 48 },
  m: { icon: 48, width: 62, height: 71 },
  l: { icon: 64, width: 82, height: 94 },
} as const;

const SHIELD = "M1.5 1.5H40.5V21C40.5 33 31 42 21 46.5C11 42 1.5 33 1.5 21Z";
const INNER = "M5 5H37V21C37 31 29 38.5 21 42.5C13 38.5 5 31 5 21Z";

export default function Crest({
  id,
  size,
  className,
  label = "Clan crest",
}: {
  id: number;
  size: "s" | "m" | "l";
  className?: string;
  label?: string;
}) {
  const { icon, width, height } = SIZES[size];
  return (
    <span
      className={className ? `${styles.crest} ${className}` : styles.crest}
      style={{ width, height }}
      role="img"
      aria-label={label}
    >
      <svg className={styles.crestShield} viewBox="0 0 42 48" width={width} height={height} aria-hidden="true">
        <path d={SHIELD} fill="#1b1b1b" stroke="#8a6d1f" strokeWidth={1.5} />
        <path d={INNER} fill="none" stroke="#3a3a3a" strokeWidth={1} />
      </svg>
      <span className={styles.crestIcon} style={{ left: (width - icon) / 2, top: Math.round(height * 0.44 - icon / 2) }}>
        <ItemIcon id={id} size={icon} />
      </span>
    </span>
  );
}
