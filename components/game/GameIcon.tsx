import Tile from "@/components/site/Tile";

import styles from "./GameIcon.module.css";

/**
 * The shared body of `ItemIcon` and `SkillIcon`: a square sprite through
 * `Tile` (still the only bare <img>), or an empty square of the same size
 * when there is nothing to draw, so a column of names stays aligned.
 *
 * The picture is decorative — it always sits next to the name it shows — so
 * its alt text is empty unless the caller has no name beside it.
 */
export default function GameIcon({
  src,
  size,
  natural,
  alt = "",
}: {
  src: string | null;
  size: number;
  natural: number;
  alt?: string;
}) {
  const className =
    size > natural ? `${styles.icon} ${styles.upscaled}` : styles.icon;
  if (src === null) {
    return (
      <span
        className={className}
        style={{ width: size, height: size }}
        aria-hidden
      />
    );
  }
  return (
    <Tile
      src={src}
      width={size}
      height={size}
      alt={alt}
      className={className}
    />
  );
}
