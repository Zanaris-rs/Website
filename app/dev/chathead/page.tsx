import type { Metadata } from "next";
import { notFound } from "next/navigation";

import Chathead from "@/components/game/Chathead";
import Frame from "@/components/site/Frame";
import Panel from "@/components/site/Panel";
import TitleBox from "@/components/site/TitleBox";
import golden from "@/lib/chathead/golden.json";
import type { Look } from "@/lib/chathead/look";

export const metadata: Metadata = {
  title: "Chathead gallery",
  robots: { index: false },
};

/**
 * Every golden look, drawn by `<Chathead>` in the browser: the check that
 * the renderer loads and draws on a real page, after a regeneration or a
 * change to `lib/chathead/`. The golden test proves the pixels; this proves
 * the page. Development only — production answers 404.
 */
export default function ChatheadGallery() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <Frame>
      <TitleBox title="Chathead gallery" />
      <Panel width="100%">
        <p>
          {golden.looks.length} looks from <code>lib/chathead/golden.json</code>
          , drawn by the bundled client renderer.
        </p>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            justifyContent: "center",
          }}
        >
          {golden.looks.map((entry) => (
            <figure key={entry.name} style={{ margin: 0, width: 133 }}>
              <Chathead look={entry.look as Look} label={entry.name} />
              <figcaption style={{ fontSize: 11 }}>{entry.name}</figcaption>
            </figure>
          ))}
        </div>
      </Panel>
    </Frame>
  );
}
