/**
 * Pre-render the scenes a figure can stand in on the character card. Run
 * through `scripts/update-scenes.sh` (`npm run scenes:update`), which
 * supplies the three paths below; `render.ts` says how a scene is drawn.
 *
 *   CLIENT_DIR  a Client-TS checkout of the revision the fleet runs
 *   ENGINE_DIR  an engine checkout whose `data/pack` has been built
 *   OUT_DIR     this repository
 *
 * Writes, for every spot in `spots.ts`:
 *
 *   public/game/scenes/<key>.png     the backdrop: the spot with no one in it
 *   lib/scenes/spots.json            each spot's eye and figure, and the version
 *
 * and `scripts/scenes/contact-sheet.png`, every spot with the reference
 * figure drawn in, to judge the framing by eye. That one is not committed.
 *
 * A spot fails the build, naming it, if drawing a figure over its backdrop
 * is not pixel for pixel the same as drawing it in the same pass: something
 * stands between that tile and the camera. Move the tile or the camera.
 * Nothing is written but the contact sheet when any spot fails.
 */

import "../chathead/browser-stub.ts";

import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { SceneSpot } from "../../lib/scenes/spots.ts";
import { encodePng } from "../game-icons/png.ts";
import { HEIGHT, openStudio, WIDTH } from "./render.ts";
import { SPOTS } from "./spots.ts";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`error: ${name} is not set; run this through scripts/update-scenes.sh`);
    process.exit(1);
  }
  return path.resolve(value);
}

const CLIENT_DIR = required("CLIENT_DIR");
const ENGINE_DIR = required("ENGINE_DIR");
const OUT_DIR = required("OUT_DIR");

const seen = new Set<string>();
for (const input of SPOTS) {
  if (seen.has(input.key)) throw new Error(`spots.ts lists ${input.key} twice: a place has one scene`);
  seen.add(input.key);
}

const studio = await openStudio(CLIENT_DIR, ENGINE_DIR, OUT_DIR);

const shots = [];
for (const input of SPOTS) {
  const shot = await studio.shoot(input);
  // encodePng writes 0 as transparent (the client's sprite rule); the sky
  // fills everything the world leaves, so a 0 here is geometry drawn true
  // black, which would come out as a hole in the card.
  const black = shot.backdrop.filter((rgb) => rgb === 0).length;
  if (black > 0) {
    throw new Error(`${input.key}: ${black} pixels are true black, which the PNG would make transparent`);
  }
  const png = encodePng(shot.backdrop, WIDTH, HEIGHT);
  const { eye, figure } = shot.spot;
  const box = shot.figureBox;
  console.log(
    `scene ${input.key} ${WIDTH}x${HEIGHT} eye ${eye.x},${eye.y},${eye.z} pitch ${eye.pitch} yaw ${eye.yaw}, ` +
      `figure at ${figure.x >> 7},${figure.z >> 7} in x ${box.left}-${box.right} y ${box.top}-${box.bottom}, ` +
      `${(png.length / 1024).toFixed(1)} KB, ` +
      (shot.differing === 0 ? "composite exact" : `composite DIFFERS in ${shot.differing} pixels`),
  );
  shots.push({ ...shot, png });
}

const sheet = studio.sheet(
  shots.map((shot) => ({
    pixels: shot.samePass,
    label: shot.differing === 0 ? shot.spot.key : `${shot.spot.key}: ${shot.differing} px differ`,
  })),
  Math.min(shots.length, 6),
);
const sheetFile = path.join(OUT_DIR, "scripts/scenes/contact-sheet.png");
writeFileSync(sheetFile, encodePng(sheet.pixels, sheet.width, sheet.height));
console.log(`sheet    ${sheet.width}x${sheet.height} -> scripts/scenes/contact-sheet.png (not committed)`);

const inexact = shots.filter((shot) => shot.differing > 0).map((shot) => shot.spot.key);
if (inexact.length > 0) {
  throw new Error(
    `${inexact.join(", ")}: a figure drawn over the backdrop is not the figure drawn in the scene; ` +
      `something stands between its tile and the camera. Move the tile or the camera in spots.ts ` +
      `(the contact sheet shows the same-pass figure).`,
  );
}

// --- write -----------------------------------------------------------------

const dir = path.join(OUT_DIR, "public/game/scenes");
mkdirSync(dir, { recursive: true });
// A spot taken out of spots.ts takes its backdrop with it.
for (const file of readdirSync(dir)) {
  if (file.endsWith(".png") && !seen.has(file.slice(0, -4))) rmSync(path.join(dir, file));
}
for (const shot of shots) writeFileSync(path.join(dir, `${shot.spot.key}.png`), shot.png);

const spots: SceneSpot[] = shots.map((shot) => shot.spot);
/**
 * One version for every backdrop and camera: the site asks for
 * `<key>.png?v=`, cached for a year (`next.config.ts`), so anything that
 * changes a picture or where the figure stands changes every URL.
 */
const hash = createHash("sha256");
for (const shot of shots) hash.update(shot.png);
const version = hash.update(JSON.stringify(spots)).digest("hex").slice(0, 12);

writeFileSync(path.join(OUT_DIR, "lib/scenes/spots.json"), JSON.stringify({ version, spots }, null, 2) + "\n");

const bytes = shots.reduce((total, shot) => total + shot.png.length, 0);
console.log(
  `scenes   ${shots.length} spots (${spots.map((spot) => spot.key).join(", ")}), every composite exact, ` +
    `${(bytes / 1024).toFixed(0)} KB -> public/game/scenes/*.png?v=${version}, lib/scenes/spots.json`,
);
process.exit(0);
