/**
 * Keep the game client itself out of a scene build.
 *
 * Two of the classes a scene is built from import `client/Client.ts`, the
 * whole game client, for one number: `ClientLocAnim` (an animated loc, lines
 * 35, 45 and 66) and `ClientPlayer` (lines 360 and 364) read the static
 * `Client.loopCycle`, the game's tick count. Loading the real file would pull
 * in the client's audio, its DOM use and its network code for nothing, so
 * this bun plugin swaps its source for a class with that one field.
 *
 * `loopCycle` stays 0: every animated loc is drawn at the frame the build
 * gives it and never advances, so two renders of a spot are the same
 * picture — which the composite check in `render.ts` depends on.
 *
 * Load this before any Client-TS module (`render.ts` imports it first). The
 * Client-TS checkout itself is never touched.
 */

import { bunPlugin } from "./bun.ts";

/** Client-TS imports it as `#/client/Client.js`, which bun resolves to this. */
const CLIENT = /\/src\/client\/Client\.ts$/;

bunPlugin({
  name: "scenes-client-shim",
  setup(build) {
    build.onLoad({ filter: CLIENT }, () => ({
      contents: "export class Client { static loopCycle = 0; }\nexport default Client;\n",
      loader: "ts",
    }));
  },
});
