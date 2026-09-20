import type { Metadata } from "next";

import EconomyChanges from "@/components/public/EconomyChanges";
import Panel from "@/components/site/Panel";
import TitleBox from "@/components/site/TitleBox";
import { ECONOMY_DEFAULT_WINDOW } from "@/lib/public/queries";
import { loadEconomyChanges } from "@/lib/public/read-server";

export const metadata: Metadata = {
  title: "Rares entering and leaving the game",
  description:
    "Which of the fifteen tracked rares have entered or left Zanaris, hour by hour, from the difference between one census and the next.",
};

/** Five minutes, like the rest of the census. */
export const revalidate = 300;

export default async function EconomyRaresPage() {
  const load = await loadEconomyChanges(ECONOMY_DEFAULT_WINDOW);

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
