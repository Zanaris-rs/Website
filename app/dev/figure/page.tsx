import type { Metadata } from "next";
import { notFound } from "next/navigation";

import Figure from "@/components/game/Figure";
import Frame from "@/components/site/Frame";
import Panel from "@/components/site/Panel";
import TitleBox from "@/components/site/TitleBox";
import figure from "@/lib/chathead/figure.json";
import golden from "@/lib/chathead/figure-golden.json";
import type { Look } from "@/lib/chathead/look";
import { TAB_SLOTS } from "@/lib/chathead/wearables";

export const metadata: Metadata = {
  title: "Figure gallery",
  robots: { index: false },
};

/**
 * The golden figures, drawn by `<Figure>` in the browser: the check that the
 * renderer loads and draws a whole body on a real page, as `/dev/chathead`
 * is for heads. There are some fifteen hundred, so the page shows the
 * outfits, kits and colours, and one slot's objects at a time
 * (`?slot=<wearpos>`). Development only — production answers 404.
 */
export default async function FigureGallery({ searchParams }: PageProps<"/dev/figure">) {
  if (process.env.NODE_ENV === "production") notFound();

  const slotParam = (await searchParams).slot;
  const slot = typeof slotParam === "string" ? Number(slotParam) : null;
  const looks = golden.looks.filter((entry) =>
    slot === null
      ? !entry.name.startsWith("obj ")
      : entry.name.startsWith("obj ") && entry.look.worn[slot] >= 0,
  );

  return (
    <Frame>
      <TitleBox title="Figure gallery" />
      <Panel width="100%">
        <p>
          {looks.length} of {golden.looks.length} looks from{" "}
          <code>lib/chathead/figure-golden.json</code>, drawn by the bundled
          client renderer. Objects by slot:{" "}
          {TAB_SLOTS.map(({ slot: wearpos, name }) => (
            <a key={wearpos} href={`/dev/figure?slot=${wearpos}`} style={{ marginRight: 6 }}>
              {name}
            </a>
          ))}
          <a href="/dev/figure">(none)</a>
        </p>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            justifyContent: "center",
          }}
        >
          {looks.map((entry) => (
            <figure key={entry.name} style={{ margin: 0, width: figure.frame.width }}>
              <Figure look={entry.look as Look} label={entry.name} />
              <figcaption style={{ fontSize: 11 }}>{entry.name}</figcaption>
            </figure>
          ))}
        </div>
      </Panel>
    </Frame>
  );
}
