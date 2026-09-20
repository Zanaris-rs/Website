import type { Metadata } from "next";

import EconomyCatalogue from "@/components/public/EconomyCatalogue";
import Panel from "@/components/site/Panel";
import TitleBox from "@/components/site/TitleBox";
import { loadEconomyCatalogue } from "@/lib/public/read-server";
import { parseItemQuery } from "@/lib/public/search";

export const metadata: Metadata = {
  title: "Every item in the game",
  description:
    "How much of every object in Zanaris exists, counted hourly from the save files. Search by name, by id, or by the name the game uses internally.",
};

/**
 * No `revalidate`, and no window segment either.
 *
 * `searchParams` is a request-time API, so reading `?q=` renders this route per
 * request whatever number is written here — a cached *page* is not on offer.
 * The reads are cached instead, inside `loadEconomyCatalogue`, so a search
 * costs a render and not a round trip.
 *
 * `public_economy_latest()` takes no window by design: how much iron ore exists
 * has one answer whichever tab is open. Only the low and high lines move, and
 * the page names the window they came from rather than leaving it to be
 * assumed.
 */
export default async function EconomyItemsPage({
  searchParams,
}: PageProps<"/economy/items">) {
  const load = await loadEconomyCatalogue();
  const query = parseItemQuery((await searchParams).q);

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

  return <EconomyCatalogue catalogue={load.data} query={query} />;
}
