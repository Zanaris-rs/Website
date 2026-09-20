import type { Metadata } from "next";
import { notFound } from "next/navigation";

import EconomyChanges from "@/components/public/EconomyChanges";
import Panel from "@/components/site/Panel";
import TitleBox from "@/components/site/TitleBox";
import {
  ECONOMY_DEFAULT_WINDOW,
  ECONOMY_WINDOWS,
  type EconomyWindow,
  economyWindow,
} from "@/lib/public/queries";
import { loadEconomyChanges } from "@/lib/public/read-server";

/** Five minutes, like `/economy/rares` itself and for the same reason. */
export const revalidate = 300;

/**
 * `/economy/[window]`'s arrangement, one section down: the three non-default
 * slugs are prerendered, every other segment is a 404, and `/economy/rares/30-days`
 * is one of them — `/economy/rares` **is** the thirty-day page, so it has one
 * URL and not two. `economyHref` enforces the same rule from the other side.
 */
export const dynamicParams = false;

export function generateStaticParams() {
  return ECONOMY_WINDOWS.filter(
    (window) => window.slug !== ECONOMY_DEFAULT_WINDOW.slug,
  ).map((window) => ({ window: window.slug }));
}

function windowOf(slug: string): EconomyWindow {
  const window = economyWindow(slug);
  if (window === null || window.slug === ECONOMY_DEFAULT_WINDOW.slug) notFound();
  return window;
}

export async function generateMetadata({
  params,
}: PageProps<"/economy/rares/[window]">): Promise<Metadata> {
  const { window } = await params;
  return {
    title: `Rares entering and leaving the game, ${windowOf(window).short}`,
    description:
      "Which of the fifteen tracked rares have entered or left Zanaris, from the difference between one census and the next.",
  };
}

export default async function EconomyRaresWindowPage({
  params,
}: PageProps<"/economy/rares/[window]">) {
  const { window } = await params;
  const load = await loadEconomyChanges(windowOf(window));

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

  return <EconomyChanges changes={load.data} />;
}
