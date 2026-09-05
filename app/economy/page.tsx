import type { Metadata } from "next";

import Economy from "@/components/public/Economy";
import Frame from "@/components/site/Frame";
import Panel from "@/components/site/Panel";
import TitleBox from "@/components/site/TitleBox";
import { loadEconomy } from "@/lib/public/read-server";

export const metadata: Metadata = {
  title: "The Economy",
  description:
    "An hourly census of every save file on Zanaris: coins in existence, accounts with a save, and what has entered or left the game.",
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
  const load = await loadEconomy();

  if (load.status !== "ok") {
    return (
      <Frame>
        <TitleBox title="The Economy" />
        <Panel>
          <p>The economy census is unavailable right now. Try again shortly.</p>
        </Panel>
      </Frame>
    );
  }

  return (
    <Frame>
      <Economy economy={load.data} />
    </Frame>
  );
}
