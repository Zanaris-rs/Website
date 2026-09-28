"use client";

import { useEffect, useRef } from "react";

import { loadClanPhoto } from "@/lib/chathead/load";
import type { Look } from "@/lib/chathead/look";
import { type SceneSpot, sceneSrc } from "@/lib/scenes/spots";

import styles from "./Clans.module.css";

/**
 * A clan photo: as many members as the spot has slots for (7, 5 or 3), in
 * their worn outfits, standing in a row in a scene, the top rank in the
 * middle. The page picks the spot and who stands where (`photoSpot`,
 * `photoSitters`). This draws them far to near into one copy of the
 * backdrop, with the game client's own renderer (`drawPlacedPhoto`), and paints
 * once. The build proved that picture is the game's own, slot for slot
 * (`scripts/scenes/render.ts`).
 *
 * It is still, so reduced motion changes nothing. The backdrop is the
 * canvas's background from the first paint, so the scene is there before
 * the renderer is. With nobody to draw, the renderer is never fetched: the
 * scene stands alone. If drawing fails, the backdrop stays alone under the
 * caption, and the console says why.
 */
export default function ClanPhoto({
  spot,
  looks,
  names,
}: {
  spot: SceneSpot;
  /** Left to right; at most the spot's slots. Saved outfits only. */
  looks: readonly Look[];
  /** The same members' names, for the label. */
  names: readonly string[];
}) {
  const canvas = useRef<HTMLCanvasElement>(null);

  // `spot` and `looks` come from the server page's props, so they keep their
  // identity across renders and this runs once.
  useEffect(() => {
    if (looks.length === 0) return;
    let current = true;
    loadClanPhoto(spot)
      .then((photo) => {
        if (!current) return;
        canvas.current?.getContext("2d")?.putImageData(photo.draw(looks).image, 0, 0);
      })
      .catch((error: unknown) => {
        // Said once, by the photo still on the page.
        if (current) console.error("[clan-photo] the photo could not be drawn; showing the scene alone:", error);
      });
    return () => {
      current = false;
    };
  }, [spot, looks]);

  const label = names.length > 0 ? `Clan photo: ${names.join(", ")} in ${spot.name}` : `Clan photo: ${spot.name}`;
  return (
    <figure className={styles.photo}>
      <canvas
        ref={canvas}
        width={spot.width}
        height={spot.height}
        role="img"
        aria-label={label}
        style={{
          width: spot.width,
          height: spot.height,
          imageRendering: "pixelated",
          backgroundImage: `url(${sceneSrc(spot)})`,
        }}
      />
      <figcaption>Clan photo</figcaption>
    </figure>
  );
}
