import TitleBox from "@/components/site/TitleBox";
import type { EconomyWindow } from "@/lib/public/queries";
import { ECONOMY_SECTIONS, economyHref } from "@/lib/public/sections";

/**
 * The census's own nav: the four pages it is made of, in the box that names it.
 *
 * They sit beside "Main menu", inside the title box, rather than in a row
 * under it — a second row of links below the box read as a separate thing that
 * had been put near the heading, when they are what the heading is *made of*.
 * The box is widened to take them, which is what `TitleBox`'s `width` is for.
 *
 * The only link that used to be here went *out* (the ban record), leaving a
 * reader on a transparency page with nowhere to go but away. These go across.
 * Somebody who has just read that staff have created nothing should be one
 * click from how that is counted and one from what the count cannot prove.
 *
 * The window rides along: a reader looking at ninety days who clicks through
 * to the rares should still be looking at ninety days, and `economyHref` drops
 * it again for the two sections that have no window to keep.
 */
export default function EconomySections({
  current,
  window,
}: {
  /** The `key` of the section being rendered. */
  current: string;
  window: EconomyWindow;
}) {
  return (
    <TitleBox
      title="The Economy"
      width="min(460px, 100%)"
      links={ECONOMY_SECTIONS.map((section) => ({
        href: economyHref(window, section.key),
        text: section.label,
        current: section.key === current,
      }))}
    />
  );
}
