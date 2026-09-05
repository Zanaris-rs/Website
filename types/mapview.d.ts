/**
 * `public/js/mapview.js` is the client's own map applet, bundled from the
 * Client-TS source by `scripts/update-worldmap.sh` and loaded at runtime by
 * URL rather than through the bundler — so TypeScript has nothing to resolve
 * and needs to be told the one thing the page uses.
 *
 * See `components/worldmap/WorldMapCanvas.tsx`.
 */
declare module "*/mapview.js" {
  /** Draws the world map into the `<canvas id="canvas">` already in the page. */
  export class MapView {
    constructor();
  }
}
