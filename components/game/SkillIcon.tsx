import { SKILL_ICON_SIZE, skillIconSrc } from "@/lib/skills/icons";

import GameIcon from "./GameIcon";

/**
 * A skill's stats-tab icon, by engine stat id (0 Attack ... 20 Runecraft).
 * Hiscores code holds category ids, which are one higher: pass
 * `statOfCategory(category)`. `null` — Overall — keeps the space empty, as
 * the 2004 hiscores list did.
 */
export default function SkillIcon({
  stat,
  size = SKILL_ICON_SIZE,
  alt,
}: {
  stat: number | null;
  size?: number;
  alt?: string;
}) {
  const src = stat === null ? null : skillIconSrc(stat);
  return <GameIcon src={src} size={size} natural={SKILL_ICON_SIZE} alt={alt} />;
}
