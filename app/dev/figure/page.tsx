import type { Metadata } from "next";
import { notFound } from "next/navigation";

import Figure from "@/components/game/Figure";
import Frame from "@/components/site/Frame";
import Panel from "@/components/site/Panel";
import TitleBox from "@/components/site/TitleBox";
import figure from "@/lib/chathead/figure.json";
import { FACING_NAMES, FACINGS } from "@/lib/chathead/facing";
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
 * (`?slot=<wearpos>`), and any of them turned (`?facing=0-15`), in the
 * turn frame. Development only — production answers 404.
 */
export default async function FigureGallery({ searchParams }: PageProps<"/dev/figure">) {
  if (process.env.NODE_ENV === "production") notFound();

  const params = await searchParams;
  const slot = typeof params.slot === "string" ? Number(params.slot) : null;
  const facing =
    typeof params.facing === "string" && /^\d{1,2}$/.test(params.facing) ? Number(params.facing) % FACINGS : undefined;
  const cell = facing === undefined ? figure.frame : figure.turnFrame;
  const looks = golden.looks.filter((entry) =>
    slot === null
      ? !entry.name.startsWith("obj ")
      : entry.name.startsWith("obj ") && entry.look.worn[slot] >= 0,
  );
  const withFacing = (href: string) => (facing === undefined ? href : `${href}${href.includes("?") ? "&" : "?"}facing=${facing}`);

  return (
    <Frame>
      <TitleBox title="Figure gallery" />
      <Panel width="100%">
        <p>
          {looks.length} of {golden.looks.length} looks from{" "}
          <code>lib/chathead/figure-golden.json</code>, drawn by the bundled
          client renderer
          {facing === undefined ? " in the plain frame" : `, turned to facing ${facing} (${FACING_NAMES[facing]}) in the turn frame`}.
          Objects by slot:{" "}
          {TAB_SLOTS.map(({ slot: wearpos, name }) => (
            <a key={wearpos} href={withFacing(`/dev/figure?slot=${wearpos}`)} style={{ marginRight: 6 }}>
              {name}
            </a>
          ))}
          <a href={withFacing("/dev/figure")}>(none)</a>
        </p>
        <p>
          Facing:{" "}
          {Array.from({ length: FACINGS }, (_, f) => (
            <a key={f} href={`/dev/figure?${slot === null ? "" : `slot=${slot}&`}facing=${f}`} style={{ marginRight: 6 }}>
              {f}
            </a>
          ))}
          <a href={slot === null ? "/dev/figure" : `/dev/figure?slot=${slot}`}>(plain)</a>
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
            <figure key={entry.name} style={{ margin: 0, width: cell.width }}>
              <Figure look={entry.look as Look} label={entry.name} facing={facing} />
              <figcaption style={{ fontSize: 11 }}>{entry.name}</figcaption>
            </figure>
          ))}
        </div>
      </Panel>
    </Frame>
  );
}
