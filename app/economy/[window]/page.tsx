import type { Metadata } from "next";
import { notFound } from "next/navigation";

import EconomyOverview from "@/components/public/EconomyOverview";
import Panel from "@/components/site/Panel";
import TitleBox from "@/components/site/TitleBox";
import {
  ECONOMY_DEFAULT_WINDOW,
  ECONOMY_WINDOWS,
  type EconomyWindow,
  economyWindow,
} from "@/lib/public/queries";
import { loadEconomyOverview } from "@/lib/public/read-server";

/** Five minutes, like `/economy` itself and for the same reason. */
export const revalidate = 300;

/**
 * The census over a window other than the default.
 *
 * Unlike `/bans/page/[n]`, these *can* be enumerated: there are four windows
 * and they are a constant in this repo, not rows in a database. So the three
 * non-default slugs are prerendered and `dynamicParams = false` makes every
 * other segment a 404 — including `/economy/30-days`, which is deliberate.
 * `/economy` **is** the thirty-day page, so it has one URL and not two, which
 * is `bansHref`'s rule and `economyHref` enforces it from the other side.
 *
 * If `DATABASE_URL` is absent at build time these three prerender as the
 * "unavailable" panel; the first request after deploy revalidates them.
 */
export const dynamicParams = false;

export function generateStaticParams() {
  return ECONOMY_WINDOWS.filter(
    (window) => window.slug !== ECONOMY_DEFAULT_WINDOW.slug,
  ).map((window) => ({ window: window.slug }));
}

function windowOf(slug: string): EconomyWindow {
  const window = economyWindow(slug);
  // Unreachable while `dynamicParams` is false, and here anyway: the default
  // window's own slug is a URL this route must not answer to.
  if (window === null || window.slug === ECONOMY_DEFAULT_WINDOW.slug) notFound();
  return window;
}

export async function generateMetadata({
  params,
}: PageProps<"/economy/[window]">): Promise<Metadata> {
  const { window } = await params;
  return {
    title: `The Economy, ${windowOf(window).short}`,
    description:
      "An hourly census of every save file on Zanaris: what exists in the game, counted item by item.",
  };
}

export default async function EconomyWindowPage({
  params,
}: PageProps<"/economy/[window]">) {
  const { window } = await params;
  const load = await loadEconomyOverview(windowOf(window));

  if (load.status !== "ok") {
    return (
      <>
        <TitleBox title="The Economy" />
        <Panel>
          <p>The economy census is unavailable right now. Try again shortly.</p>
        </Panel>
      </>
    );
  }

  return <EconomyOverview economy={load.data} />;
}
