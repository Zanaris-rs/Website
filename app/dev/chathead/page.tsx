import type { Metadata } from "next";
import { notFound } from "next/navigation";

import Chathead from "@/components/game/Chathead";
import Frame from "@/components/site/Frame";
import Panel from "@/components/site/Panel";
import TitleBox from "@/components/site/TitleBox";
import figureGolden from "@/lib/chathead/figure-golden.json";
import golden from "@/lib/chathead/golden.json";
import type { Look } from "@/lib/chathead/look";

import Motion from "./Motion";

export const metadata: Metadata = {
  title: "Chathead gallery",
  robots: { index: false },
};

/** Figures that hold something in each hand, so an emote's empty hands show. */
const MOVING = ["rune armour male", "two-handed sword and shield female"];

/**
 * Every golden look, drawn by `<Chathead>` in the browser: the check that
 * the renderer loads and draws on a real page, after a regeneration or a
 * change to `lib/chathead/`. Above them, the emotes and the moods, played by
 * `<Figure>` and `<Chathead>`. The golden tests prove the pixels; this
 * proves the page. Development only — production answers 404.
 */
export default function ChatheadGallery() {
  if (process.env.NODE_ENV === "production") notFound();

  const figures = MOVING.map((name) => {
    const entry = figureGolden.looks.find((look) => look.name === name)!;
    return { name, look: entry.look as Look };
  });
  const head = { name: golden.looks[0].name, look: golden.looks[0].look as Look };

  return (
    <Frame>
      <TitleBox title="Chathead gallery" />
      <Panel width="100%">
        <p>
          The twelve emotes and the fourteen moods from{" "}
          <code>lib/chathead/anims.json</code>, played by the bundled client
          renderer at the game&apos;s 50 cycles a second.
        </p>
        <Motion figures={figures} head={head} />
      </Panel>
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
