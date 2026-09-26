/**
 * Shoot a scene: a spot in the world drawn by the game client's own `World`,
 * `ClientBuild`, `Pix3D` and `Model`, from Client-TS under bun, at the
 * character card's 240x300.
 *
 * A spot's region is built exactly as `Client.mapBuild` builds the one
 * around the player (Client.ts:5143-5218): the mapsquares that cover the
 * 13x13 zones around it, their ground, then their locs, then `finishBuild`.
 * The camera is placed as the game places it (`camFollow`), and `renderAll`
 * draws the frame. What a browser can't have — the cache, the map, the
 * config decoding — stays here; the site gets a PNG and a camera.
 *
 * Five things differ from the game, each the throwaway spike's fix made
 * permanent:
 *
 * - `client-shim.ts` stands in for `client/Client.ts`, whose one number
 *   (`loopCycle`) is all a scene reads from it;
 * - `far.ts` draws 40 tiles instead of 25, so the edge of the world is not a
 *   wall across an eye-level frame;
 * - `visBacking` gets tables for pitches below the game's 128, which the
 *   eye-level camera uses (see `openStudio`);
 * - `Math.random` is pinned (see `pinned`);
 * - a sky is painted behind (see `sky`), where the game leaves black.
 *
 * And each spot proves the site can draw a figure into it: see `shoot`.
 */

import "../chathead/browser-stub.ts";
import "./client-shim.ts";
// far.ts, imported below, registers its plugin as it is evaluated: before
// any Client-TS module, all of which are imported in openStudio.

import { readFileSync } from "node:fs";
import path from "node:path";

import { type BodyTables, buildBody } from "../../lib/chathead/body.ts";
import { type Client, type ClientModel, prepare } from "../../lib/chathead/client.ts";
import type { Look } from "../../lib/chathead/look.ts";
import type { SceneSpot } from "../../lib/scenes/spots.ts";
import FileCache from "../game-icons/cache.ts";
import { GAME_FAR, TILES } from "./far.ts";
import type { SpotInput } from "./spots.ts";

/** The card's scene frame (spec: "With a scene, the frame is 240x300"). */
export const WIDTH = 240;
export const HEIGHT = 300;

// --- the slice of Client-TS this uses -------------------------------------

type Jag = { read(name: string): Uint8Array | null };

/** A model as the world draws it (`World.ts:1476`). */
export type WorldModel = ClientModel & {
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
};

type Scene = {
  fillBaseLevel(level: number): void;
  addDynamic(
    level: number,
    x: number,
    y: number,
    z: number,
    model: WorldModel,
    typecode: number,
    yaw: number,
    padding: number,
    forwardPadding: boolean,
  ): boolean;
  renderAll(eyeX: number, eyeY: number, eyeZ: number, maxLevel: number, eyeYaw: number, eyePitch: number): void;
  removeSprites(): void;
};

type WorldClass = {
  new (groundh: Int32Array[][], maxTileZ: number, maxLevel: number, maxTileX: number): Scene;
  lowMem: boolean;
  resetVisCalc(pitchDistance: Int32Array, frustumStart: number, frustumEnd: number, width: number, height: number): void;
};

type Collision = object;

type Builder = {
  loadGround(src: Uint8Array, originX: number, originZ: number, xOffset: number, zOffset: number): void;
  fadeAdjacent(startZ: number, startX: number, endZ: number, endX: number): void;
  loadLocations(src: Uint8Array, xOffset: number, zOffset: number, world: Scene, collision: Collision[]): void;
  finishBuild(world: Scene, collision: Collision[]): void;
};

type ClientBuildClass = {
  new (maxTileX: number, maxTileZ: number, groundh: Int32Array[][], mapl: Uint8Array[][]): Builder;
  lowMem: boolean;
  minusedlevel: number;
  checkLocations(src: Uint8Array, xOffset: number, zOffset: number): boolean;
};

type PacketClass = new (src: Uint8Array) => { g1(): number; g2(): number };
type ConfigClass = { init(config: Jag): void };
type PixFontClass = {
  depack(
    archive: Jag,
    name: string,
    quill: boolean,
  ): { drawStringTag(text: string, x: number, y: number, rgb: number, shadowed: boolean): void };
};

// --- determinism ------------------------------------------------------------

/**
 * Run `fn` with `Math.random` pinned to the midpoint, as `prepare`
 * (lib/chathead/client.ts) does for the colour table's brightness. The
 * client rolls it wherever a scene is built: `ClientBuild`'s static
 * `hueOff`/`ligOff` when the class is first evaluated and their nudge in
 * every `finishBuild`, each floor's overlay colour as `FloType` decodes the
 * config, and each animated loc's starting frame (`ClientLocAnim`). At 0.5
 * the offsets come out 0 and the frames the middle one, so every build of a
 * spot is the same picture, whatever was built before it.
 */
async function pinned<T>(fn: () => T | Promise<T>): Promise<T> {
  const random = Math.random;
  Math.random = () => 0.5;
  try {
    return await fn();
  } finally {
    Math.random = random;
  }
}

// --- the studio ----------------------------------------------------------------

/** The game's new-player look (`Player.body`), wearing nothing. */
const REFERENCE: Look = {
  gender: 0,
  kits: [0, 10, 18, 26, 33, 36, 42],
  colours: [0, 0, 0, 0, 0],
  worn: new Array<number>(14).fill(-1),
};

/** The build area: 13 zones of 8 tiles (`BuildArea.SIZE`). */
const SIZE = 104;

/** Where the figure lands in the frame, from the pixels it changed. */
export type Box = { left: number; top: number; right: number; bottom: number };

export type Shot = {
  spot: SceneSpot;
  /** The scene with no one in it: the PNG. */
  backdrop: Int32Array;
  /** The reference figure drawn with `worldRender` over the backdrop. */
  composite: Int32Array;
  /** The reference figure drawn by `renderAll`, in the same pass. */
  samePass: Int32Array;
  /** Pixels where `composite` and `samePass` differ. 0 is exact. */
  differing: number;
  figureBox: Box;
};

export type Studio = {
  shoot(input: SpotInput): Promise<Shot>;
  /** Lay frames out side by side with a label on each, for looking at. */
  sheet(frames: { pixels: Int32Array; label: string }[], columns: number): { pixels: Int32Array; width: number; height: number };
};

/**
 * Load the client and the cache once, for any number of shots. `clientDir`
 * is the Client-TS checkout, `engineDir` an engine whose `data/pack` is
 * built, `outDir` this repository (for the figure's `bodies.json`).
 */
export async function openStudio(clientDir: string, engineDir: string, outDir: string): Promise<Studio> {
  const client = async <T>(file: string): Promise<T> =>
    (await import(path.join(clientDir, "src", file))).default as T;

  // Pinned while the classes are first evaluated: ClientBuild rolls its
  // hue and lightness offsets as a static initialiser.
  const { JagFile, Packet, Model, Pix3D, Pix2D, AnimFrame, LocType, FloType, SeqType, World, ClientBuild, CollisionMap, PixFont } =
    await pinned(async () => ({
      JagFile: await client<new (src: Uint8Array) => Jag>("io/JagFile.ts"),
      Packet: await client<PacketClass>("io/Packet.ts"),
      Model: await client<Client["Model"]>("dash3d/Model.ts"),
      Pix3D: await client<Client["Pix3D"] & { lowMem: boolean; setClipping(width: number, height: number): void }>(
        "dash3d/Pix3D.ts",
      ),
      Pix2D: await client<Client["Pix2D"]>("graphics/Pix2D.ts"),
      AnimFrame: await client<Client["AnimFrame"]>("dash3d/AnimFrame.ts"),
      LocType: await client<ConfigClass>("config/LocType.ts"),
      FloType: await client<ConfigClass>("config/FloType.ts"),
      SeqType: await client<ConfigClass>("config/SeqType.ts"),
      World: await client<WorldClass>("dash3d/World.ts"),
      ClientBuild: await client<ClientBuildClass>("client/ClientBuild.ts"),
      CollisionMap: await client<new () => Collision>("dash3d/CollisionMap.ts"),
      PixFont: await client<PixFontClass>("graphics/PixFont.ts"),
    }));
  const source: Client = { Model, Pix3D, Pix2D, AnimFrame };

  // --- the cache, in the client's start-up order (Client.ts:1152-1160) ----

  const pack = path.join(engineDir, "data/pack");
  const jag = (name: string) => new JagFile(new Uint8Array(readFileSync(path.join(pack, "client", name))));
  const config = jag("config");
  const versionlist = jag("versionlist");
  const cache = new FileCache(pack, 5);

  World.lowMem = false;
  Pix3D.lowMem = false;
  ClientBuild.lowMem = false;

  await pinned(() => {
    Pix3D.unpackTextures(jag("textures"));
    prepare(source); // the colour table
    Pix3D.initPool(20);
    SeqType.init(config);
    LocType.init(config);
    FloType.init(config);
  });

  // Every model up front, so a region's locs and the figure are all ready
  // the first time they are asked for (the client waits on its downloads).
  const modelTotal = cache.count(1);
  Model.init(modelTotal, {
    requestModel(id: number) {
      throw new Error(`model ${id} is not in the cache (${modelTotal} models): repack the engine`);
    },
  });
  for (let id = 0; id < modelTotal; id++) Model.unpack(id, cache.readGzip(1, id));

  // Every anim frame: animated locs, and the figure's stance.
  const animIndex = versionlist.read("anim_index");
  if (!animIndex) throw new Error("client/versionlist has no anim_index: repack the engine");
  AnimFrame.init(animIndex.length / 2);
  for (let file = 0; file < cache.count(2); file++) {
    const data = cache.readGzip(2, file);
    if (data) AnimFrame.unpack(data);
  }

  // The mapsquares (OnDemand.ts:86-100): land and loc file for each.
  const mapIndex = versionlist.read("map_index");
  if (!mapIndex) throw new Error("client/versionlist has no map_index: repack the engine");
  const maps = new Map<number, { land: number; loc: number }>();
  const index = new Packet(mapIndex);
  for (let i = 0; i < mapIndex.length / 7; i++) {
    const square = index.g2();
    const land = index.g2();
    const loc = index.g2();
    index.g1(); // members
    maps.set(square, { land, loc });
  }

  const bodies = JSON.parse(
    readFileSync(path.join(outDir, "lib/chathead/bodies.json"), "utf8"),
  ) as BodyTables;
  const title = jag("title");
  const font = PixFont.depack(title, "p12_full", false);

  // --- the view ---------------------------------------------------------------

  Pix3D.setClipping(WIDTH, HEIGHT);
  // The game's pitch distances (Client.ts:1227-1235).
  const distance = new Int32Array(9);
  for (let x = 0; x < 9; x++) {
    const angle = x * 32 + 128 + 15;
    distance[x] = ((angle * 3 + 600) * Pix3D.sinTable[angle]) >> 16;
  }
  World.resetVisCalc(distance, 500, 800, WIDTH, HEIGHT);

  // `resetVisCalc` works out which tiles can be seen only for the game's
  // pitches, 128 to 383, and `renderAll` looks the table up at
  // `visBacking[((pitch - 128) / 32) | 0]` (World.ts:974) — for the lower,
  // eye-level pitches a scene uses, 0 to 96, a negative index (-4 to -1),
  // which is no table at all. Those get one that calls every tile around
  // the camera visible: the renderer still skips what is behind or beside
  // the camera, face by face, so it only costs time. Its sides are far.ts's
  // distance. (97 to 127 truncate to 0, the game's table for 128, which
  // misses what a lower camera sees: `shoot` refuses them.)
  const visBacking = (World as unknown as { visBacking: boolean[][][][] }).visBacking;
  const side = 2 * TILES + 1;
  const everything = Array.from({ length: 32 }, () =>
    Array.from({ length: side }, () => new Array<boolean>(side).fill(true)),
  );
  for (let table = -4; table < 0; table++) visBacking[table] = everything;

  /**
   * The sky: a gradient, lighter toward the horizon. Every frame starts as
   * this instead of the game's clear colour, black (`Pix2D.cls`), so it
   * shows wherever the world leaves the clear colour — above the horizon
   * and past the draw distance.
   */
  function sky(): Int32Array {
    const pixels = new Int32Array(WIDTH * HEIGHT);
    for (let y = 0; y < HEIGHT; y++) {
      const t = y / HEIGHT;
      const rgb = (((96 + 120 * t) | 0) << 16) | (((150 + 80 * t) | 0) << 8) | ((220 + 30 * t) | 0);
      pixels.fill(rgb, y * WIDTH, (y + 1) * WIDTH);
    }
    return pixels;
  }

  // --- a region ----------------------------------------------------------------

  /** `Client.mapBuild` for the build area around a tile, minus the network. */
  function buildRegion(input: SpotInput) {
    const zoneX = input.x >> 3;
    const zoneZ = input.z >> 3;
    const baseX = (zoneX - 6) * 8;
    const baseZ = (zoneZ - 6) * 8;

    const groundh = Array.from({ length: 4 }, () => Array.from({ length: SIZE + 1 }, () => new Int32Array(SIZE + 1)));
    const mapl = Array.from({ length: 4 }, () => Array.from({ length: SIZE }, () => new Uint8Array(SIZE)));
    const world = new World(groundh, SIZE, 4, SIZE);
    const collision = [0, 1, 2, 3].map(() => new CollisionMap());

    // The mapsquares covering the 13x13 zones (Client.ts:6842-6872).
    const squares: { x: number; z: number; land: Uint8Array | null; loc: Uint8Array | null }[] = [];
    for (let mx = ((zoneX - 6) / 8) | 0; mx <= (((zoneX + 6) / 8) | 0); mx++) {
      for (let mz = ((zoneZ - 6) / 8) | 0; mz <= (((zoneZ + 6) / 8) | 0); mz++) {
        const files = maps.get((mx << 8) + mz);
        squares.push({
          x: mx * 64 - baseX,
          z: mz * 64 - baseZ,
          land: files ? cache.readGzip(4, files.land) : null,
          loc: files ? cache.readGzip(4, files.loc) : null,
        });
      }
    }

    // `Client.checkScene`: every loc model must be ready before the build.
    // All of them were unpacked above, so the first check passes or a
    // model is missing from the cache.
    for (const square of squares) {
      if (square.loc && !ClientBuild.checkLocations(square.loc, square.x, square.z)) {
        throw new Error(`${input.key}: a loc model around ${input.x},${input.z} is not in the cache: repack the engine`);
      }
    }

    ClientBuild.minusedlevel = input.level;
    const build = new ClientBuild(SIZE, SIZE, groundh, mapl);
    world.fillBaseLevel(0);
    for (const s of squares) if (s.land) build.loadGround(s.land, baseX, baseZ, s.x, s.z);
    for (const s of squares) if (!s.land && zoneZ < 800) build.fadeAdjacent(s.z, s.x, 64, 64);
    for (const s of squares) if (s.loc) build.loadLocations(s.loc, s.x, s.z, world, collision);
    build.finishBuild(world, collision);
    return { world, groundh, mapl, baseX, baseZ };
  }

  /** `Client.getAvH`: the ground's height under a point, bridges included. */
  function groundHeight(groundh: Int32Array[][], mapl: Uint8Array[][], sceneX: number, sceneZ: number, level: number) {
    const tileX = sceneX >> 7;
    const tileZ = sceneZ >> 7;
    const real = level < 3 && (mapl[1][tileX][tileZ] & 0x2) !== 0 ? level + 1 : level; // MapFlag.LinkBelow
    const localX = sceneX & 0x7f;
    const localZ = sceneZ & 0x7f;
    const h = groundh[real];
    const y00 = (h[tileX][tileZ] * (128 - localX) + h[tileX + 1][tileZ] * localX) >> 7;
    const y11 = (h[tileX][tileZ + 1] * (128 - localX) + h[tileX + 1][tileZ + 1] * localX) >> 7;
    return (y00 * (128 - localZ) + y11 * localZ) >> 7;
  }

  /** `Client.camFollow` (Client.ts:4432-4465): where the eye is. */
  function camFollow(pitch: number, yaw: number, targetX: number, targetY: number, targetZ: number, dist: number) {
    const invPitch = (2048 - pitch) & 0x7ff;
    const invYaw = (2048 - yaw) & 0x7ff;
    let x = 0;
    let y = 0;
    let z = dist;
    if (invPitch !== 0) {
      const sin = Pix3D.sinTable[invPitch];
      const cos = Pix3D.cosTable[invPitch];
      const tmp = (y * cos - dist * sin) >> 16;
      z = (y * sin + dist * cos) >> 16;
      y = tmp;
    }
    if (invYaw !== 0) {
      const sin = Pix3D.sinTable[invYaw];
      const cos = Pix3D.cosTable[invYaw];
      const tmp = (z * sin + x * cos) >> 16;
      z = (z * cos - x * sin) >> 16;
      x = tmp;
    }
    return { x: targetX - x, y: targetY - y, z: targetZ - z };
  }

  /** The reference figure, freshly built: `buildBody` hands out the one scratch model. */
  function figure(): WorldModel {
    const body = buildBody(source, bodies, REFERENCE);
    if (!body) throw new Error("the reference look built no body: re-run npm run chathead:update");
    return body as WorldModel;
  }

  // --- a shot ----------------------------------------------------------------

  /**
   * Draw a spot, and prove a figure can be drawn into it afterwards.
   *
   * The backdrop is the spot with no one in it. The site will draw the
   * player's figure over it with `worldRender`, from the same eye, as
   * `World` would have (World.ts:1476). That is only the picture the game
   * would draw if nothing the world draws after the figure — a wall, a
   * fence, a table, the ground rising in front — covers any of its pixels:
   * `World` paints back to front, and a composite puts the figure last.
   *
   * So the reference figure is drawn both ways — in the same pass, with
   * `addDynamic`, and over the finished backdrop — and the pixels compared.
   * `build.ts` refuses a spot where any differ.
   */
  async function shoot(input: SpotInput): Promise<Shot> {
    if (!((input.pitch >= 0 && input.pitch <= 96) || (input.pitch >= 128 && input.pitch <= 383))) {
      throw new Error(
        `${input.key}: pitch ${input.pitch} has no visibility table; use 0-96 (eye level) or the game's 128-383`,
      );
    }
    if (input.yaw < 0 || input.yaw > 2047) {
      throw new Error(`${input.key}: yaw ${input.yaw} is not an angle; use 0-2047`);
    }

    return pinned(() => {
      const region = buildRegion(input);
      const tileX = input.x - region.baseX;
      const tileZ = input.z - region.baseZ;
      if (tileX < 0 || tileZ < 0 || tileX >= SIZE || tileZ >= SIZE) {
        throw new Error(`${input.key}: ${input.x},${input.z} is outside its own build area`);
      }

      // The figure stands in the middle of its tile, on the ground, facing the camera.
      const fx = tileX * 128 + 64;
      const fz = tileZ * 128 + 64;
      const fy = groundHeight(region.groundh, region.mapl, fx, fz, input.level);
      const facing = (2048 - input.yaw) & 2047;

      const eye = camFollow(input.pitch, input.yaw, fx, fy - input.lift, fz, input.dist);
      // renderAll clamps an eye outside the build area; the site's figure would not.
      if (eye.x < 0 || eye.z < 0 || eye.x >= SIZE * 128 || eye.z >= SIZE * 128) {
        throw new Error(`${input.key}: the camera is outside the build area; shorten dist`);
      }

      const sinPitch = Pix3D.sinTable[input.pitch];
      const cosPitch = Pix3D.cosTable[input.pitch];
      const sinYaw = Pix3D.sinTable[input.yaw];
      const cosYaw = Pix3D.cosTable[input.yaw];
      // The figure's depth, as worldRender works it out: the site draws it with
      // the game's own far clip, which far.ts does not reach.
      const zPrime = ((fz - eye.z) * cosYaw - (fx - eye.x) * sinYaw) >> 16;
      const depth = ((fy - eye.y) * sinPitch + zPrime * cosPitch) >> 16;
      if (depth >= GAME_FAR) {
        throw new Error(`${input.key}: the figure is ${depth} deep, past the game's far clip of ${GAME_FAR}; shorten dist`);
      }

      const render = (withFigure: boolean): Int32Array => {
        const pixels = sky();
        Pix2D.setPixels(pixels, WIDTH, HEIGHT);
        Pix3D.setClipping(WIDTH, HEIGHT);
        if (withFigure) region.world.addDynamic(input.level, fx, fy, fz, figure(), 0, facing, 60, false);
        region.world.renderAll(eye.x, eye.y, eye.z, 3, input.yaw, input.pitch);
        region.world.removeSprites();
        return pixels;
      };

      const backdrop = render(false);
      const samePass = render(true);

      // What the site will do: the backdrop, then the figure over it.
      const composite = backdrop.slice();
      Pix2D.setPixels(composite, WIDTH, HEIGHT);
      Pix3D.setRenderClipping();
      figure().worldRender(facing, sinPitch, cosPitch, sinYaw, cosYaw, fx - eye.x, fy - eye.y, fz - eye.z, 0);

      let differing = 0;
      const box: Box = { left: WIDTH, top: HEIGHT, right: -1, bottom: -1 };
      for (let i = 0; i < composite.length; i++) {
        if (composite[i] !== samePass[i]) differing++;
        if (composite[i] !== backdrop[i]) {
          const x = i % WIDTH;
          const y = (i / WIDTH) | 0;
          box.left = Math.min(box.left, x);
          box.right = Math.max(box.right, x);
          box.top = Math.min(box.top, y);
          box.bottom = Math.max(box.bottom, y);
        }
      }
      if (box.right < 0) {
        throw new Error(`${input.key}: the figure is not in the frame; aim the camera at it`);
      }

      const spot: SceneSpot = {
        key: input.key,
        name: input.name,
        width: WIDTH,
        height: HEIGHT,
        // World coordinates, so the tile is readable; worldRender only
        // ever uses figure minus eye.
        eye: {
          x: eye.x + region.baseX * 128,
          y: eye.y,
          z: eye.z + region.baseZ * 128,
          pitch: input.pitch,
          yaw: input.yaw,
        },
        figure: { x: input.x * 128 + 64, y: fy, z: input.z * 128 + 64, yaw: facing },
      };
      return { spot, backdrop, composite, samePass, differing, figureBox: box };
    });
  }

  function sheet(frames: { pixels: Int32Array; label: string }[], columns: number) {
    const gap = 4;
    const rows = Math.ceil(frames.length / columns);
    const width = columns * (WIDTH + gap) + gap;
    const height = rows * (HEIGHT + gap) + gap;
    const pixels = new Int32Array(width * height).fill(0x202020);
    frames.forEach((frame, i) => {
      const left = gap + (i % columns) * (WIDTH + gap);
      const top = gap + ((i / columns) | 0) * (HEIGHT + gap);
      for (let y = 0; y < HEIGHT; y++) {
        pixels.set(frame.pixels.subarray(y * WIDTH, (y + 1) * WIDTH), (top + y) * width + left);
      }
    });
    Pix2D.setPixels(pixels, width, height);
    frames.forEach((frame, i) => {
      const left = gap + (i % columns) * (WIDTH + gap);
      const top = gap + ((i / columns) | 0) * (HEIGHT + gap);
      font.drawStringTag(frame.label, left + 4, top + 14, 0xffff00, true);
    });
    return { pixels, width, height };
  }

  return { shoot, sheet };
}
