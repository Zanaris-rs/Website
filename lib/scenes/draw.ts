import { type BodyTables, buildBody, type Pose } from "../chathead/body.ts";
import type { Client, ClientModel } from "../chathead/client.ts";
import type { Frame } from "../chathead/draw.ts";
import type { Look } from "../chathead/look.ts";
import type { SceneSpot } from "./spots.ts";

/**
 * A figure standing in a scene: drawn by the game client's own `Model`
 * straight onto the scene's backdrop, from the spot's eye, as `World` draws
 * a player standing on a tile (World.ts:1476).
 *
 * The same functions draw it in three places: the browser, with
 * `renderer.js`; `scripts/scenes/render.ts`, with Client-TS's source, which
 * proves each spot by comparing the result with the game's own picture of
 * the scene with the figure in it; and `composite.test.ts`, which holds the
 * first to the second.
 *
 * The figure goes onto the backdrop's own pixels rather than being drawn
 * alone and laid over it. The two agree for a model whose faces are all
 * solid, but not for one with see-through faces — a chainbody's — which the
 * game blends with whatever is behind them: the scene, not an empty frame.
 */

type Size = { width: number; height: number };

/**
 * The picture a scene is drawn in: the spot's size, with `Pix3D`'s origin at
 * its centre, where `setRenderClipping` puts it for the world's viewport.
 */
export function sceneFrame(spot: Size): Frame {
  return {
    width: spot.width,
    height: spot.height,
    originX: (spot.width / 2) | 0,
    originY: (spot.height / 2) | 0,
  };
}

/**
 * A posed, lit model drawn into a copy of a spot's backdrop at the spot's
 * eye (World.ts:1476: `sprite.model.worldRender(sprite.yaw, cameraSinX,
 * cameraCosX, cameraSinY, cameraCosY, sprite.x - cx, sprite.y - cy,
 * sprite.z - cz, typecode)`, where X is the pitch and Y the yaw). The
 * backdrop is left as it was.
 */
export function drawAtEye(
  client: Client,
  model: ClientModel,
  spot: SceneSpot,
  backdrop: Int32Array,
): Int32Array {
  if (backdrop.length !== spot.width * spot.height) {
    throw new Error(`${spot.key}: the backdrop is not ${spot.width}x${spot.height}`);
  }
  const pixels = backdrop.slice();
  client.Pix2D.setPixels(pixels, spot.width, spot.height);
  client.Pix3D.setRenderClipping();

  const { eye, figure } = spot;
  const { sinTable, cosTable } = client.Pix3D;
  model.worldRender(
    figure.yaw,
    sinTable[eye.pitch],
    cosTable[eye.pitch],
    sinTable[eye.yaw],
    cosTable[eye.yaw],
    figure.x - eye.x,
    figure.y - eye.y,
    figure.z - eye.z,
    0,
  );
  return pixels;
}

/**
 * A look standing at a spot — or, with a `pose`, in one frame of an emote —
 * drawn into its backdrop; null when the look has no body to draw.
 */
export function drawAtSpot(
  client: Client,
  tables: BodyTables,
  look: Look,
  spot: SceneSpot,
  backdrop: Int32Array,
  pose?: Pose,
): Int32Array | null {
  const body = buildBody(client, tables, look, pose);
  return body ? drawAtEye(client, body, spot, backdrop) : null;
}

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/**
 * A backdrop PNG as the client's pixels (`0xRRGGBB`), exactly as the build
 * had them before `encodePng` (scripts/game-icons/png.ts) wrote them:
 * 8-bit RGBA, rows unfiltered, every pixel opaque. Anything else is refused,
 * naming the fix.
 *
 * The page decodes the file itself rather than drawing it on a canvas and
 * reading the canvas back: a browser may change what a canvas hands back —
 * fingerprinting defences add noise to it, or blank it — and the figure is
 * drawn onto these pixels.
 */
export async function decodeBackdrop(png: Uint8Array, size: Size): Promise<Int32Array> {
  if (!SIGNATURE.every((byte, i) => png[i] === byte)) throw new Error("backdrop: not a PNG");

  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  let header: { width: number; height: number; depth: number; colour: number; interlace: number } | null =
    null;
  const compressed: Uint8Array<ArrayBuffer>[] = [];
  for (let at = 8; at < png.length; ) {
    const length = view.getUint32(at);
    const end = at + 12 + length;
    if (end > png.length) throw new Error("backdrop: a chunk runs past the end of the file");
    const type = String.fromCharCode(...png.subarray(at + 4, at + 8));
    const data = png.subarray(at + 8, at + 8 + length);
    if (type === "IHDR") {
      const ihdr = new DataView(data.buffer, data.byteOffset, data.byteLength);
      header = {
        width: ihdr.getUint32(0),
        height: ihdr.getUint32(4),
        depth: data[8],
        colour: data[9],
        interlace: data[12],
      };
    } else if (type === "IDAT") {
      compressed.push(data.slice());
    } else if (type === "IEND") {
      break;
    }
    at = end;
  }

  const { width, height } = size;
  if (!header) throw new Error("backdrop: no IHDR");
  if (header.width !== width || header.height !== height) {
    throw new Error(`backdrop: ${header.width}x${header.height}, not the spot's ${width}x${height}`);
  }
  if (header.depth !== 8 || header.colour !== 6 || header.interlace !== 0) {
    throw new Error("backdrop: not the build's 8-bit RGBA; re-run npm run scenes:update");
  }

  const inflated = new Blob(compressed).stream().pipeThrough(new DecompressionStream("deflate"));
  const raw = new Uint8Array(await new Response(inflated).arrayBuffer());
  const stride = 1 + width * 4;
  if (raw.length !== height * stride) throw new Error("backdrop: the image data is the wrong size");

  const pixels = new Int32Array(width * height);
  for (let y = 0; y < height; y++) {
    if (raw[y * stride] !== 0) {
      throw new Error("backdrop: a filtered row, which the build never writes; re-run npm run scenes:update");
    }
    for (let x = 0; x < width; x++) {
      const at = y * stride + 1 + x * 4;
      if (raw[at + 3] !== 0xff) throw new Error("backdrop: a pixel that is not opaque");
      pixels[x + y * width] = (raw[at] << 16) | (raw[at + 1] << 8) | raw[at + 2];
    }
  }
  return pixels;
}
