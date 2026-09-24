/**
 * The slice of the game client the chathead is drawn with.
 *
 * `public/game/chathead/renderer.js` is the client's own `Model`, `Pix3D`
 * and `Pix2D`, bundled straight from the Client-TS source by
 * `scripts/update-chathead.sh` — the same code that draws the head in a
 * quest dialogue, so a chathead here is pixel for pixel the one in game. It is
 * not ported and not part of this app's bundle; these types are the part of
 * its surface the site calls, and the golden test holds the two together.
 *
 * The build script passes the Client-TS source classes to the same functions,
 * which is how it draws the reference pictures that test checks against.
 */

export interface ClientModel {
  recolour(src: number, dst: number): void;
  calculateNormals(
    ambient: number,
    contrast: number,
    x: number,
    y: number,
    z: number,
    doNotShareLight: boolean,
  ): void;
  objRender(
    pitch: number,
    yaw: number,
    roll: number,
    eyePitch: number,
    eyeX: number,
    eyeY: number,
    eyeZ: number,
  ): void;
}

export interface ClientModelClass {
  init(total: number, provider: { requestModel(id: number): void }): void;
  unpack(id: number, src: Uint8Array | null): void;
  load(id: number): ClientModel | null;
  combineForAnim(models: (ClientModel | null)[], count: number): ClientModel;
}

export interface ClientPix3D {
  originX: number;
  originY: number;
  sinTable: Int32Array;
  cosTable: Int32Array;
  initColourTable(brightness: number): void;
  setRenderClipping(): void;
}

export interface ClientPix2D {
  setPixels(pixels: Int32Array, width: number, height: number): void;
}

/** What `renderer.js` exports, and what the build passes from the source. */
export type Client = {
  Model: ClientModelClass;
  Pix3D: ClientPix3D;
  Pix2D: ClientPix2D;
};

/**
 * The client's start-up, the part a chathead depends on.
 *
 * The client shades with a colour table it builds once, nudging the
 * brightness by up to ±0.015 at random so no two sessions shade a model
 * identically. Pinned to the midpoint, as the icon build does, every browser
 * draws the same pixels and the golden test can compare them exactly.
 */
export function prepare(client: Client): void {
  const random = Math.random;
  Math.random = () => 0.5;
  try {
    client.Pix3D.initColourTable(0.8);
  } finally {
    Math.random = random;
  }
}
