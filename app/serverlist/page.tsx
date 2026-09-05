import type { Metadata } from "next";

import Frame from "@/components/site/Frame";
import Panel from "@/components/site/Panel";
import TitleBox from "@/components/site/TitleBox";
import WorldTable from "@/components/WorldTable";

export const metadata: Metadata = {
  title: "Play Zanaris",
  description:
    "Pick a world and play in your browser, at high or low detail.",
};

/** The world list, in the page chrome like everything else. */
export default function ServerList() {
  return (
    <Frame>
      <TitleBox title="Select a World" />
      <Panel>
        <WorldTable />
      </Panel>
    </Frame>
  );
}
