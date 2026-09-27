import type { Metadata } from "next";
import { notFound } from "next/navigation";

import SceneFigure from "@/components/game/SceneFigure";
import Frame from "@/components/site/Frame";
import Panel from "@/components/site/Panel";
import TitleBox from "@/components/site/TitleBox";
import { FACING_NAMES, FACINGS, nearestFacing } from "@/lib/chathead/facing";
import type { Look } from "@/lib/chathead/look";
import golden from "@/lib/scenes/composite-golden.json";
import { SCENES } from "@/lib/scenes/spots";

export const metadata: Metadata = {
  title: "Scene gallery",
  robots: { index: false },
};

/**
 * Every scene with the build's bulky reference look standing in it, turned
 * to one facing (`?facing=0-15`) or, where the build did not prove that one,
 * the nearest it did (`spot.turns`): the check that turned figures draw in
 * every spot on a real page, whatever the database holds. Development only
 * - production answers 404.
 */
export default async function SceneGallery({ searchParams }: PageProps<"/dev/scenes">) {
  if (process.env.NODE_ENV === "production") notFound();

  const raw = (await searchParams).facing;
  const facing = typeof raw === "string" && /^\d{1,2}$/.test(raw) ? Number(raw) % FACINGS : 0;
  const look = golden.looks["the bulky look"] as Look;

  return (
    <Frame>
      <TitleBox title="Scene gallery" />
      <Panel width="100%">
        <p>
          Every spot in <code>lib/scenes/spots.json</code> with the bulky reference look at facing {facing} (
          {FACING_NAMES[facing]}), or the nearest facing the build proved there. Facing:{" "}
          {Array.from({ length: FACINGS }, (_, f) => (
            <a key={f} href={`/dev/scenes?facing=${f}`} style={{ marginRight: 6 }}>
              {f}
            </a>
          ))}
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
          {SCENES.spots.map((spot) => (
            <figure key={spot.key} style={{ margin: 0, width: spot.width }}>
              <SceneFigure spot={spot} look={look} facing={facing} label={`${spot.name}, facing ${facing}`} />
              <figcaption style={{ fontSize: 11 }}>
                {spot.key}: drawn at {nearestFacing(facing, spot.turns)}; turns {spot.turns.join(",")}
              </figcaption>
            </figure>
          ))}
        </div>
      </Panel>
    </Frame>
  );
}
