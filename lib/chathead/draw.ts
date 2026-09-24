import type { Client, ClientModel } from "./client.ts";
import { buildHead, type HeadTables } from "./head.ts";
import type { Look } from "./look.ts";

/**
 * The dialogue camera: the model component the chat interfaces put the
 * player's head in (`content/scripts/interface_chat/interfaces/chat1.if`,
 * `com_0`: `zoom=796 xan=40 yan=166`), drawn the way the client draws any
 * model component (`Client.ts`, the `if_setplayerhead` branch).
 */
export const CAMERA = { zoom: 796, xan: 40, yan: 166 } as const;

/**
 * A pixel the renderer did not touch. Every colour it writes is 24-bit, so a
 * bit above them marks the background — unlike 0, which the colour table can
 * produce for a black face. A face drawn with alpha blends over this as if it
 * were black, since the blend masks each channel.
 */
export const BACKGROUND = 0x1000000;

export type Frame = HeadTables["frame"];

/**
 * Draw a lit head into a frame-sized buffer and return the pixels. The model
 * is expected to have been lit already (`calculateNormals`).
 */
export function drawModel(
  client: Client,
  model: ClientModel,
  frame: Frame,
): Int32Array {
  const pixels = new Int32Array(frame.width * frame.height).fill(BACKGROUND);
  client.Pix2D.setPixels(pixels, frame.width, frame.height);
  client.Pix3D.setRenderClipping();
  client.Pix3D.originX = frame.originX;
  client.Pix3D.originY = frame.originY;

  const eyeY = (client.Pix3D.sinTable[CAMERA.xan] * CAMERA.zoom) >> 16;
  const eyeZ = (client.Pix3D.cosTable[CAMERA.xan] * CAMERA.zoom) >> 16;
  model.objRender(0, CAMERA.yan, 0, CAMERA.xan, 0, eyeY, eyeZ);
  return pixels;
}

/**
 * The light every model component gets (`IfType.getTempModel`): the head is
 * built unlit, and lit once it is about to be drawn.
 */
export function light(model: ClientModel): void {
  model.calculateNormals(64, 768, -50, -10, -50, true);
}

/** A look's chathead, or null when it has no head to draw. */
export function renderChathead(
  client: Client,
  tables: HeadTables,
  look: Look,
): Int32Array | null {
  const head = buildHead(client, tables, look);
  if (!head) return null;
  light(head);
  return drawModel(client, head, tables.frame);
}

/** Frame pixels as canvas RGBA, the background transparent. */
export function toRgba(pixels: Int32Array): Uint8ClampedArray<ArrayBuffer> {
  const rgba = new Uint8ClampedArray(pixels.length * 4);
  for (let i = 0; i < pixels.length; i++) {
    const rgb = pixels[i];
    if (rgb === BACKGROUND) continue;
    rgba[i * 4] = (rgb >> 16) & 0xff;
    rgba[i * 4 + 1] = (rgb >> 8) & 0xff;
    rgba[i * 4 + 2] = rgb & 0xff;
    rgba[i * 4 + 3] = 0xff;
  }
  return rgba;
}
