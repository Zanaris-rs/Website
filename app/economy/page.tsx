import type { Metadata } from "next";

import EconomyOverview from "@/components/public/EconomyOverview";
import Panel from "@/components/site/Panel";
import TitleBox from "@/components/site/TitleBox";
import { ECONOMY_DEFAULT_WINDOW } from "@/lib/public/queries";
import { loadEconomyOverview } from "@/lib/public/read-server";

export const metadata: Metadata = {
  title: "The Economy",
  description:
    "An hourly census of every save file on Zanaris: what exists in the game, counted item by item, and what has entered or left it.",
};

/**
 * Five minutes, like /bans, and for a stronger reason: the census itself runs
 * once an hour, so a page rendered per request would ask three questions of
 * the database to show the same answer it showed a second ago. Five minutes is
 * short enough that a new census appears promptly and long enough that a busy
 * day costs one read.
 */
export const revalidate = 300;

export default async function EconomyPage() {
  // The default window has one URL, and this is it — `/economy/30-days` is a
  // 404, and `app/economy/[window]/page.tsx` refuses to answer to it.
  const load = await loadEconomyOverview(ECONOMY_DEFAULT_WINDOW);

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
