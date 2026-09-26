/**
 * The slice of the game client chatheads and figures are drawn with.
 *
 * `public/game/chathead/renderer.js` is the client's own `Model`, `Pix3D`,
 * `Pix2D` and `AnimFrame`, bundled straight from the Client-TS source by
 * `scripts/update-chathead.sh` — the same code that draws the head in a
 * quest dialogue and the player in the world, so a picture here is pixel for
 * pixel the one in game. It is not ported and not part of this app's bundle;
 * these types are the part of its surface the site calls, and the golden
 * tests hold the two together.
 *
 * The build script passes the Client-TS source classes to the same functions,
 * which is how it draws the reference pictures that test checks against.
 */

export interface ClientModel {
  recolour(src: number, dst: number): void;
  /** Move every point; the arguments are y, x, z, in that order. */
  translate(y: number, x: number, z: number): void;
  /**
   * Group the points and faces by their animation labels. A chathead's copy
   * is prepared before each animated draw (`IfType.ts:382`).
   */
  prepareAnim(): void;
  /**
   * Pose the model with one `AnimFrame`, by frame id; -1, or a frame not in
   * the table, leaves it as it is. A chathead is posed with the seq's frame,
   * then its `iframes` frame (`IfType.ts:386`, `:390`).
   */
  animate(frame: number): void;
  /** Become a copy of `src` that an animation can move without moving it. */
  set(src: ClientModel, shareAlpha: boolean): void;
  calcBoundingCylinder(): void;
  /**
   * Light the model. A model component lights its copy last, after the
   * animation (`IfType.ts:393`, `light()` in `draw.ts`).
   */
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
  /**
   * Draw the model into the world's picture, as `World` draws every model
   * standing on a tile — players, NPCs, objects (Client-TS
   * `dash3d/World.ts:1476`): turned by `yaw` about its own base, at
   * `relative*` from the eye (the model's position minus the camera's, in
   * scene units), seen through the eye's pitch and yaw, each passed as
   * `Pix3D`'s sine and cosine of the angle. It projects about `Pix3D`'s
   * origin, which `setRenderClipping` puts at the picture's centre, where
   * the world's viewport has it. `typecode` is what a click on it would
   * pick: 0, nothing.
   *
   * It draws nothing nearer than 50 or past the game's far clip, 3500 deep.
   */
  worldRender(
    yaw: number,
    sinEyePitch: number,
    cosEyePitch: number,
    sinEyeYaw: number,
    cosEyeYaw: number,
    relativeX: number,
    relativeY: number,
    relativeZ: number,
    typecode: number,
  ): void;
}

export interface ClientModelClass {
  init(total: number, provider: { requestModel(id: number): void }): void;
  unpack(id: number, src: Uint8Array | null): void;
  load(id: number): ClientModel | null;
  combineForAnim(models: (ClientModel | null)[], count: number): ClientModel;
  /**
   * A new model that an animation can move without moving `src`: its points
   * copied unless `shareVertices`, its colours and alpha copied unless
   * shared, the rest (faces, labels, textures) shared. A model component
   * copies its model with it every time it draws an animated one
   * (`IfType.getTempModel`, `IfType.ts:380`: colours shared, vertices not,
   * alpha shared only when neither frame is set), then prepares, animates
   * and lights the copy (`:382`, `:386`, `:390`, `:393`) with the members
   * above.
   */
  copyForAnim(
    src: ClientModel,
    shareColours: boolean,
    shareAlpha: boolean,
    shareVertices: boolean,
  ): ClientModel;
  /** The one scratch model the client animates players in. */
  tempModel: ClientModel;
}

export interface ClientPix3D {
  originX: number;
  originY: number;
  sinTable: Int32Array;
  cosTable: Int32Array;
  initColourTable(brightness: number): void;
  setRenderClipping(): void;
  /**
   * Unpack the textures from an archive — the client's `JagFile`, or
   * anything that hands out the same files by name (`index.dat`, `<id>.dat`).
   */
  unpackTextures(textures: { read(name: string): Uint8Array | null }): void;
  /** Make room to expand `size` textures at once. */
  initPool(size: number): void;
}

export interface ClientAnimFrame {
  /** Size the frame table for ids up to `total`. */
  init(total: number): void;
  /** Read one anim file: a skeleton (`AnimBase`) and frames on it. */
  unpack(data: Uint8Array): void;
  /** Whether a frame leaves the model's alpha alone: only "no frame" (-1). */
  animateTransparencies(frame: number): boolean;
}

export interface ClientPix2D {
  setPixels(pixels: Int32Array, width: number, height: number): void;
}

/** What `renderer.js` exports, and what the build passes from the source. */
export type Client = {
  Model: ClientModelClass;
  Pix3D: ClientPix3D;
  Pix2D: ClientPix2D;
  AnimFrame: ClientAnimFrame;
};

/**
 * The client's start-up, the part a chathead or a figure depends on.
 *
 * The client shades with a colour table it builds once, nudging the
 * brightness by up to ±0.015 at random so no two sessions shade a model
 * identically. Pinned to the midpoint, as the icon build does, every browser
 * draws the same pixels and the golden test can compare them exactly.
 *
 * The table also holds each texture's palette, so the client builds it after
 * unpacking the textures. Running this again after `unpackTextures` does the
 * same; with the brightness pinned, the colours come out as before.
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
