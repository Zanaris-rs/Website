import { ITEM_ICON_SIZE, itemIconSrc } from "@/lib/items/icons";

import GameIcon from "./GameIcon";

/**
 * An item's inventory icon, by object id — the same id `itemName` takes.
 * Ids with no icon (the client's invisible placeholders, or an id newer than
 * the committed icons) keep their space and show nothing.
 */
export default function ItemIcon({
  id,
  size = ITEM_ICON_SIZE,
  alt,
}: {
  id: number;
  size?: number;
  alt?: string;
}) {
  return (
    <GameIcon
      src={itemIconSrc(id)}
      size={size}
      natural={ITEM_ICON_SIZE}
      alt={alt}
    />
  );
}
