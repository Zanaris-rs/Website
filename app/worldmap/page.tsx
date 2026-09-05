import type { Metadata } from "next";

import Frame from "@/components/site/Frame";
import Panel from "@/components/site/Panel";
import TitleBox from "@/components/site/TitleBox";
import WorldMapCanvas from "@/components/worldmap/WorldMapCanvas";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "World Map",
  description:
    "The map of the Zanaris world, drawn from the game's own map data.",
};

/** The map applet, with the original's three paragraphs of instructions. */
export default function WorldMap() {
  return (
    <Frame>
      <TitleBox title={`Map of the ${SITE_NAME} World`} />

      <WorldMapCanvas />

      <Panel align="left">
        <p>
          <b>Using the Main Map</b>
          <br />
          Click and drag the left mouse button on the main map to move the map
          around. Click on the different percentage buttons at the bottom of the
          applet to zoom in and out.
        </p>
        <p>
          <b>Using the Overview Map</b>
          <br />
          Click on the &quot;Overview&quot; button to bring up the overview map.
          The red shaded area indicates the area the main map is showing. Left
          click on the overview map to move the main map around quickly.
        </p>
        <p>
          <b>Using the Key</b>
          <br />
          Click on the &quot;Key&quot; button to bring up the key. There are two
          pages in the key; clicking on the &quot;Prev page&quot; or &quot;Next
          page&quot; buttons will allow you to navigate them. Clicking on any
          item in the key will locate all icons on the map of that type (they
          will flash yellow for a while).
        </p>
      </Panel>
    </Frame>
  );
}
