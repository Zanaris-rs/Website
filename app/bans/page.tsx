import type { Metadata } from "next";

import Bans from "@/components/public/Bans";
import Frame from "@/components/site/Frame";
import Panel from "@/components/site/Panel";
import TitleBox from "@/components/site/TitleBox";
import { loadPunishments } from "@/lib/public/read-server";

export const metadata: Metadata = {
  title: "Bans and Mutes",
  description:
    "The permanent public record of every ban and mute issued on Zanaris.",
};

/**
 * Five minutes of cache. The record is public, identical for everybody and
 * changes when a moderator acts, which is neither often nor urgent — so one
 * reader every five minutes pays for the query and the rest are served a
 * prerendered page. It also means a burst of readers after a big ban cannot
 * turn into a burst of database connections.
 */
export const revalidate = 300;

/** Page 1 of the permanent record. `/bans/page/2` onwards is the same list. */
export default async function BansPage() {
  const load = await loadPunishments(1);

  if (load.status !== "ok") {
    return (
      <Frame>
        <TitleBox title="Bans and Mutes" />
        <Panel>
          <p>The ban record is unavailable right now. Try again shortly.</p>
        </Panel>
      </Frame>
    );
  }

  return (
    <Frame>
      <Bans page={load.data} />
    </Frame>
  );
}
