import {
  ECONOMY_DEFAULT_WINDOW,
  ECONOMY_WINDOWS,
  type EconomyWindow,
} from "./queries";

/**
 * The four pages /economy is made of, and where a window of each one lives.
 *
 * The census used to be one page. It carried six unrelated jobs — the totals,
 * every object in the game, what moved, what staff created, and the notes
 * saying what all of that does and does not mean — and it ran to eight screens,
 * so the note explaining that "entered and left the game" counts rares only sat
 * six screens below the list it explained. These are the seams it came apart
 * along.
 *
 * **The slug is a path segment, and so is a window's.** `/economy/[window]`
 * and `/economy/items` are siblings, so a section named `24-hours` or a window
 * named `items` would be one route shadowing the other — and Next resolves a
 * static segment first, so the *section* would silently win and a tab would
 * stop working. `sections.test.ts` holds them apart; keep it that way when
 * adding either.
 *
 * `windowed` is whether the four tabs mean anything here. They do not on
 * `items`: `public_economy_latest()` takes no window by design, because how
 * much iron ore exists has one answer whichever tab is open. They do not on
 * `about`, which is prose.
 */
export type EconomySection = {
  readonly key: string;
  /** The path segment under `/economy`; empty for the overview, which *is* `/economy`. */
  readonly slug: string;
  /** For the section nav at the top of every one of them. */
  readonly label: string;
  /** Whether the window tabs apply — see above. */
  readonly windowed: boolean;
};

export const ECONOMY_SECTIONS: readonly EconomySection[] = [
  { key: "overview", slug: "", label: "Overview", windowed: true },
  { key: "items", slug: "items", label: "Items", windowed: false },
  { key: "rares", slug: "rares", label: "Rares", windowed: true },
  { key: "about", slug: "about", label: "How this works", windowed: false },
];

/** The section a key names, or `null`. */
export function economySection(key: string): EconomySection | null {
  return ECONOMY_SECTIONS.find((section) => section.key === key) ?? null;
}

/**
 * Where a window of a section lives: `/economy`, `/economy/7-days`,
 * `/economy/rares`, `/economy/rares/7-days`.
 *
 * `bansHref`'s rule, once per section: the default window has no slug of its
 * own, so nothing has to decide whether `/economy/rares` or
 * `/economy/rares/30-days` is the canonical one — the second is a 404, and
 * `generateStaticParams` does not offer it.
 *
 * A section that takes no window ignores the one it is given rather than
 * refusing it, so the nav can pass the window the reader is on to every link
 * without asking which of them care.
 */
export function economyHref(
  window: { slug: string },
  section: string = "overview",
): string {
  const found = economySection(section);
  const base = found && found.slug ? `/economy/${found.slug}` : "/economy";
  if (found && !found.windowed) return base;
  return window.slug === ECONOMY_DEFAULT_WINDOW.slug
    ? base
    : `${base}/${window.slug}`;
}

/** The windows a section's tabs offer, or none at all. */
export function sectionWindows(section: EconomySection): readonly EconomyWindow[] {
  return section.windowed ? ECONOMY_WINDOWS : [];
}
