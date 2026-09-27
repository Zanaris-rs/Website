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
 *   lib/scenes/spots.json            each spot's eye, figure and turns, and the version
 *   lib/scenes/composite-golden.json the proved composites' hashes, which
 *                                    `lib/scenes/composite.test.ts` holds the
 *                                    site's renderer to
 *
 * and `scripts/scenes/contact-sheet.png`, every spot with the reference
 * figure drawn in, to judge the framing by eye. That one is not committed.
 *
 * Every spot is proved at every facing (`lib/chathead/facing.ts`): drawing a
 * figure over its backdrop must be pixel for pixel the same as drawing it in
 * the same pass, for every reference look (`LOOKS`), standing and in every
 * frame of every emote. Facing the camera (facing 0) it must: a spot that
 * fails there fails the build - something stands between that tile and the
 * camera; the error names the spot, the look, the emote and the frame; move
 * the tile or the camera. Any other facing that fails is left out of the
 * spot's `turns`, which a turn on the site walks, and printed. The figure is
 * drawn over the backdrop by the site's own function (`lib/scenes/draw.ts`),
 * so what is proved is what a page draws. Nothing is written but the
 * contact sheet, which then shows the first failing pose, when a spot fails
 * facing the camera.
 */

import "../chathead/browser-stub.ts";

import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import { FACINGS } from "../../lib/chathead/facing.ts";
import type { SceneSpot } from "../../lib/scenes/spots.ts";
import { encodePng } from "../game-icons/png.ts";
import { LOOKS } from "./looks.ts";
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

const started = performance.now();
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
  const { eye, figure, turns } = shot.spot;
  const box = shot.figureBox;
  console.log(
    `scene ${input.key} ${WIDTH}x${HEIGHT} eye ${eye.x},${eye.y},${eye.z} pitch ${eye.pitch} yaw ${eye.yaw}, ` +
      `figure at ${figure.x >> 7},${figure.z >> 7} in x ${box.left}-${box.right} y ${box.top}-${box.bottom}, ` +
      `${(png.length / 1024).toFixed(1)} KB, ` +
      (shot.failures.length === 0
        ? `turns ${turns.length} of ${FACINGS} (${turns.join(",")}), ${shot.proofs} composites compared`
        : `composite DIFFERS facing the camera in ${shot.failures.length} looks and poses`),
  );
  for (const drop of shot.dropped) {
    console.log(`      dropped facing ${drop.facing}: ${drop.look}, ${drop.pose} differs in ${drop.differing} px`);
  }
  shots.push({ ...shot, png });
}

const proofs = shots.reduce((total, shot) => total + shot.proofs, 0);
const seconds = ((performance.now() - started) / 1000).toFixed(1);
console.log(`proofs   ${proofs} composites compared with their same-pass renders in ${seconds} s`);
const droppedBySpot = shots
  .filter((shot) => shot.dropped.length > 0)
  .map((shot) => `${shot.spot.key} ${shot.dropped.map((drop) => drop.facing).join(",")}`);
console.log(
  `turns    ${droppedBySpot.length === 0 ? `every spot turns through all ${FACINGS} facings` : `dropped: ${droppedBySpot.join("; ")}`}`,
);

const sheet = studio.sheet(
  shots.map((shot) => {
    const failure = shot.failures[0];
    return failure
      ? { pixels: failure.samePass, label: `${shot.spot.key}: ${failure.pose}, ${failure.differing} px` }
      : { pixels: shot.samePass, label: shot.spot.key };
  }),
  Math.min(shots.length, 6),
);
const sheetFile = path.join(OUT_DIR, "scripts/scenes/contact-sheet.png");
writeFileSync(sheetFile, encodePng(sheet.pixels, sheet.width, sheet.height));
console.log(`sheet    ${sheet.width}x${sheet.height} -> scripts/scenes/contact-sheet.png (not committed)`);

const inexact = shots.filter((shot) => shot.failures.length > 0);
if (inexact.length > 0) {
  const listed = inexact.map((shot) => {
    const first = shot.failures
      .slice(0, 4)
      .map((failure) => `${failure.look}, ${failure.pose} (${failure.differing} px)`);
    const more = shot.failures.length - first.length;
    return `${shot.spot.key}: ${first.join("; ")}${more > 0 ? `; and ${more} more` : ""}`;
  });
  throw new Error(
    `a figure drawn over the backdrop facing the camera is not the figure drawn in the scene at\n  ${listed.join("\n  ")}\n` +
      `Something stands between its tile and the camera. Move the tile or the camera in spots.ts ` +
      `(the contact sheet shows the game's picture of the first failing pose).`,
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
 * One version for every backdrop, camera and list of turns: the site asks
 * for `<key>.png?v=`, cached for a year (`next.config.ts`), so anything that
 * changes a picture or where and how the figure stands changes every URL.
 */
const hash = createHash("sha256");
for (const shot of shots) hash.update(shot.png);
const version = hash.update(JSON.stringify(spots)).digest("hex").slice(0, 12);

writeFileSync(path.join(OUT_DIR, "lib/scenes/spots.json"), JSON.stringify({ version, spots }, null, 2) + "\n");

/**
 * The composites the site's renderer must draw, pixel for pixel:
 *
 * - every look standing, at every proved facing, at every spot;
 * - at the first spot, every look in every pose facing the camera, and the
 *   default look in every pose at every other proved facing.
 *
 * Plus each spot's proved facings (`turns`), which spots.json must agree
 * with. One draw per line, as the chathead goldens are written.
 */
const draws = shots.flatMap((shot, index) =>
  shot.hashes
    .filter((entry) => entry.emote === null || (index === 0 && (entry.facing === 0 || entry.look === LOOKS[0].name)))
    .map((entry) => ({ spot: shot.spot.key, ...entry })),
);
const turnsBySpot = Object.fromEntries(spots.map((spot) => [spot.key, spot.turns]));
const looks = Object.fromEntries(LOOKS.map(({ name, look }) => [name, look]));
writeFileSync(
  path.join(OUT_DIR, "lib/scenes/composite-golden.json"),
  `{"version":${JSON.stringify(version)},"bodies":${JSON.stringify(studio.versions.bodies)},` +
    `"anims":${JSON.stringify(studio.versions.anims)},\n"turns":${JSON.stringify(turnsBySpot)},\n` +
    `"looks":${JSON.stringify(looks)},\n"draws":[\n` +
    draws.map((draw) => JSON.stringify(draw)).join(",\n") +
    "\n]}\n",
);

const bytes = shots.reduce((total, shot) => total + shot.png.length, 0);
console.log(
  `scenes   ${shots.length} spots (${spots.map((spot) => spot.key).join(", ")}), every composite exact facing the camera, ` +
    `${(bytes / 1024).toFixed(0)} KB -> public/game/scenes/*.png?v=${version}, lib/scenes/spots.json`,
);
console.log(`golden   ${draws.length} composites -> lib/scenes/composite-golden.json`);
process.exit(0);
