import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { AnimTables } from "../../lib/chathead/anims.ts";
import { encodeBodies } from "../../lib/chathead/bodies-file.ts";
import { type BodyTables, buildBody, FIGURE_CAMERA } from "../../lib/chathead/body.ts";
import type { Client, ClientModel } from "../../lib/chathead/client.ts";
import { BACKGROUND, drawModel, type Frame } from "../../lib/chathead/draw.ts";
import { FACINGS, plainYaw } from "../../lib/chathead/facing.ts";
import { type Look, toAppearance } from "../../lib/chathead/look.ts";
import type FileCache from "../game-icons/cache.ts";
import { figurePoses, LOOKS } from "../scenes/looks.ts";
import type { WearPos } from "./server-obj.ts";
import { paramNamed, type ParamType } from "./server-param.ts";
import { cutAnim, framesIn } from "./stances.ts";

/**
 * What the site draws a player's whole body with — a figure, the player
 * standing as the world shows them — and the pictures that prove it draws
 * them right, written by `build.ts`:
 *
 *   public/game/chathead/bodies.bin   every body model, their textures, the stance frames
 *   lib/chathead/bodies.json          kits, worn objects, what hides what, stances, palettes
 *   lib/chathead/figure.json          the frame, the turn frame and the version, for the page itself
 *   lib/chathead/figure-golden.json   reference pictures for the golden test
 *   lib/chathead/turn-golden.json     reference pictures turned, in the turn frame (exportTurns)
 *
 * The reference pictures are drawn by the client's own
 * `ClientPlayer.getTempModel2`, fed the slots and the stance straight from
 * the server's config rather than from the exported tables, so the golden
 * test checks the site's body assembly, the tables and the bundled renderer
 * together.
 */

type Jag = { read(name: string): Uint8Array | null };

type IdkTypeClass = {
  list: {
    part: number;
    disable: boolean;
    model: Int32Array | null;
    recol_s: Int32Array;
    recol_d: Int32Array;
  }[];
};

type ObjTypeClass = {
  numDefinitions: number;
  list(id: number): {
    name: string | null;
    manwear: number;
    manwear2: number;
    manwear3: number;
    womanwear: number;
    womanwear2: number;
    womanwear3: number;
    manwearOffset: number;
    womanwearOffset: number;
    recol_s: Uint16Array | null;
    recol_d: Uint16Array | null;
  };
};

type SeqTypeClass = { list: { frames: Int16Array | null }[] };

/** A `ClientPlayer`, as far as a figure's reference pictures use one. */
export type StandingPlayer = {
  ready: boolean;
  gender: number;
  appearance: Uint16Array;
  colour: Uint16Array;
  baseId: bigint;
  readyanim: number;
  secondaryAnim: number;
  secondaryAnimFrame: number;
  /** An emote's reference plays it as the primary seq (`anims.ts`). */
  primaryAnim: number;
  primaryAnimFrame: number;
  primaryAnimDelay: number;
  getTempModel2(): ClientModel | null;
};

type ClientPlayerClass = new () => StandingPlayer;

type SourceModel = ClientModel & {
  numFaces: number;
  faceRenderType: Int32Array | null;
  faceColour: Int32Array | null;
};

export type BodyInputs = {
  /** The client's source classes, which draw the reference pictures. */
  source: Client;
  IdkType: IdkTypeClass;
  ObjType: ObjTypeClass;
  SeqType: SeqTypeClass;
  ClientPlayer: ClientPlayerClass;
  cache: FileCache;
  modelTotal: number;
  textures: Jag;
  wearpos: readonly WearPos[];
  params: readonly ParamType[];
  recol1d: readonly (readonly number[])[];
  recol2d: readonly number[];
  /** The chathead's golden bodies, the defaults every look below starts from. */
  maleKits: readonly number[];
  femaleKits: readonly number[];
  outDir: string;
};

/** The anim archive in the on-demand cache (`main_file_cache.idx2`). */
const ANIM_ARCHIVE = 2;

/** A box every figure fits in with room to spare, to measure them in. */
const PROBE: Frame = { width: 400, height: 520, originX: 200, originY: 440 };

export function exportBodies(input: BodyInputs) {
  const { source, IdkType, ObjType, SeqType, ClientPlayer, cache, wearpos } = input;

  // --- tables -------------------------------------------------------------

  const bodyModels = new Set<number>();

  const kits: BodyTables["kits"][number][] = IdkType.list.map((kit) => {
    const model = kit.model ? [...kit.model] : [];
    model.forEach((id) => bodyModels.add(id));
    // `getModelNoCheck` stops at the first empty source colour, and at six.
    const recol: [number, number][] = [];
    for (let i = 0; i < 6 && kit.recol_s[i] !== 0; i++) {
      recol.push([kit.recol_s[i], kit.recol_d[i]]);
    }
    return { model, recol };
  });

  /** The worn models the client joins, in order (`getWearModelNoCheck`). */
  function worn(first: number, second: number, third: number): number[] {
    if (first === -1) return [];
    if (second === -1) return [first];
    return third === -1 ? [first, second] : [first, second, third];
  }

  // What a look may wear: the editor's list, which is `validate.ts`'s rule.
  const wearable = (id: number) => wearpos[id].wearpos >= 0 && !wearpos[id].dummy;

  const objs: Record<string, BodyTables["objs"][string]> = {};
  for (let id = 0; id < ObjType.numDefinitions; id++) {
    if (!wearable(id)) continue;
    // `list` hands out one of ten recycled instances: copy, don't keep.
    const obj = ObjType.list(id);
    const man = worn(obj.manwear, obj.manwear2, obj.manwear3);
    const woman = worn(obj.womanwear, obj.womanwear2, obj.womanwear3);
    if (man.length === 0 && woman.length === 0) continue;

    [...man, ...woman].forEach((model) => bodyModels.add(model));
    const recol: [number, number][] = [];
    if (obj.recol_s && obj.recol_d) {
      for (let i = 0; i < obj.recol_s.length; i++) {
        recol.push([obj.recol_s[i], obj.recol_d[i]]);
      }
    }
    objs[id] = {
      man,
      woman,
      offset: [obj.manwearOffset, obj.womanwearOffset],
      recol,
    };
  }

  // Every object that empties a slot, whatever the slot.
  const hides: Record<string, number[]> = {};
  wearpos.forEach(({ wearpos2, wearpos3 }, id) => {
    const slots = [wearpos2, wearpos3].filter((slot) => slot >= 0);
    if (slots.length > 0) hides[id] = slots;
  });

  // The stances: `update_bas` stands a player in their weapon's
  // `ready_baseanim`, whose default is `human_ready`.
  const ready = paramNamed(input.params, "ready_baseanim");
  if (ready.defaultInt === null) {
    throw new Error("the param ready_baseanim has no default stance");
  }
  const weapons: Record<string, number> = {};
  wearpos.forEach(({ params }, id) => {
    const seq = params.get(ready.id);
    if (typeof seq === "number" && wearable(id)) weapons[id] = seq;
  });
  const frames: Record<string, number> = {};
  for (const seq of new Set([ready.defaultInt, ...Object.values(weapons)])) {
    const first = SeqType.list[seq]?.frames?.[0];
    if (first === undefined) throw new Error(`stance seq ${seq} has no frames`);
    frames[seq] = first;
  }

  const tables: Omit<BodyTables, "version"> = {
    kits,
    objs,
    hides,
    stances: { default: ready.defaultInt, weapons, frames },
    recol1d: input.recol1d.map((palette) => [...palette]),
    recol2d: [...input.recol2d],
  };

  // --- the stance frames --------------------------------------------------

  const wanted = new Set(Object.values(frames));
  const fileOf = new Map<number, number>();
  let frameTotal = 0;
  for (let file = 0; file < cache.count(ANIM_ARCHIVE); file++) {
    const data = cache.readGzip(ANIM_ARCHIVE, file);
    if (!data) continue;
    for (const id of framesIn(data)) {
      frameTotal = Math.max(frameTotal, id + 1);
      if (wanted.has(id)) fileOf.set(id, file);
    }
  }
  const animFiles = new Map<number, Set<number>>();
  for (const id of wanted) {
    const file = fileOf.get(id);
    if (file === undefined) throw new Error(`stance frame ${id} is in no anim file`);
    animFiles.set(file, (animFiles.get(file) ?? new Set()).add(id));
  }

  // The reference poses with the cache's own files, whole; the site with
  // the cut ones.
  source.AnimFrame.init(frameTotal);
  const anims: Uint8Array[] = [];
  for (const [file, keep] of [...animFiles].sort(([a], [b]) => a - b)) {
    const data = cache.readGzip(ANIM_ARCHIVE, file)!;
    source.AnimFrame.unpack(data);
    anims.push(cutAnim(data, keep));
  }

  // --- models and their textures -----------------------------------------

  const models = new Map<number, Uint8Array>();
  const textureIds = new Set<number>();
  for (const id of [...bodyModels].sort((a, b) => a - b)) {
    const bytes = cache.readGzip(1, id);
    if (!bytes) throw new Error(`body model ${id} is not in the cache`);
    models.set(id, bytes);

    // A textured face (render type bit 2) keeps its texture id as its colour.
    const model = source.Model.load(id) as SourceModel | null;
    if (!model?.faceRenderType || !model.faceColour) continue;
    for (let face = 0; face < model.numFaces; face++) {
      if ((model.faceRenderType[face] & 2) === 2) textureIds.add(model.faceColour[face]);
    }
  }

  const textureFiles = new Map<string, Uint8Array>();
  for (const name of ["index.dat", ...[...textureIds].map((id) => `${id}.dat`)]) {
    const file = input.textures.read(name);
    if (!file) throw new Error(`the textures archive has no ${name}`);
    textureFiles.set(name, file);
  }

  const bodiesBin = encodeBodies({
    models: { total: input.modelTotal, models },
    frames: frameTotal,
    anims,
    textures: textureFiles,
  });

  // --- golden looks -------------------------------------------------------

  const NO_COLOURS = [0, 0, 0, 0, 0];
  const NOTHING_WORN = new Array<number>(14).fill(-1);

  function look(
    gender: number,
    change: { kits?: readonly number[]; colours?: number[]; worn?: [number, number][] } = {},
  ): Look {
    const wornSlots = [...NOTHING_WORN];
    for (const [slot, obj] of change.worn ?? []) wornSlots[slot] = obj;
    return {
      gender,
      kits: [...(change.kits ?? (gender === 1 ? input.femaleKits : input.maleKits))],
      colours: change.colours ?? NO_COLOURS,
      worn: wornSlots,
    };
  }
  const genderName = (gender: number) => (gender === 1 ? "female" : "male");

  const golden: { name: string; look: Look }[] = [
    { name: "male default", look: look(0) },
    { name: "female default", look: look(1) },
    { name: "no kits", look: look(0, { kits: [-1, -1, -1, -1, -1, -1, -1] }) },
  ];

  // Whole outfits, one per gender: a full set of armour (the platebody hides
  // the arms, the helm the hair and jaw), a two-handed sword that hides the
  // shield still in its slot, and a staff and robes in the staff's stance.
  const OUTFITS: [string, [number, number][]][] = [
    ["rune armour", [[0, 1163], [1, 1007], [2, 1704], [3, 1333], [4, 1127], [5, 1201], [7, 1079], [9, 1059], [10, 1061]]],
    ["two-handed sword and shield", [[3, 1319], [5, 1201], [4, 1113]]],
    ["staff and robes", [[0, 579], [3, 1381], [4, 577], [7, 1011], [10, 1061]]],
  ];
  for (const [name, wornSlots] of OUTFITS) {
    for (const gender of [0, 1]) {
      golden.push({ name: `${name} ${genderName(gender)}`, look: look(gender, { worn: wornSlots }) });
    }
  }

  // Every kit with a body, in its own slot on its own gender's default.
  kits.forEach((kit, id) => {
    const { part, disable } = IdkType.list[id];
    if (kit.model.length === 0 || disable) return;
    const gender = part >= 7 ? 1 : 0;
    const base = [...(gender === 1 ? input.femaleKits : input.maleKits)];
    base[part % 7] = id;
    golden.push({ name: `kit ${id}`, look: look(gender, { kits: base }) });
  });

  // Every colour of every part, one part at a time.
  input.recol1d.forEach((palette, part) => {
    for (let colour = 1; colour < palette.length; colour++) {
      const colours = [...NO_COLOURS];
      colours[part] = colour;
      for (const gender of [0, 1]) {
        golden.push({
          name: `colour part ${part} = ${colour} ${genderName(gender)}`,
          look: look(gender, { colours }),
        });
      }
    }
  });

  // Every wearable object, worn where it is worn, on both genders — the
  // weapons each in their own stance, the chainbodies with their textures.
  for (let id = 0; id < wearpos.length; id++) {
    if (!wearable(id)) continue;
    for (const gender of [0, 1]) {
      golden.push({
        name: `obj ${id} ${genderName(gender)}`,
        look: look(gender, { worn: [[wearpos[id].wearpos, id]] }),
      });
    }
  }

  // --- reference drawing --------------------------------------------------

  // The slots and the stance as the server decides them, from its config
  // (`Player.generateAppearance`, `update_bas`) — worked out again here, not
  // read from the tables, so that a table written wrong fails the test.
  const serverHides: Record<string, number[]> = {};
  wearpos.forEach(({ wearpos2, wearpos3 }, id) => {
    const slots = [wearpos2, wearpos3].filter((slot) => slot >= 0);
    if (slots.length > 0) serverHides[id] = slots;
  });
  function serverStance(entry: Look): number {
    const weapon = entry.worn[3];
    if (weapon < 0) return ready.defaultInt!;
    const seq = wearpos[weapon].params.get(ready.id);
    return typeof seq === "number" ? seq : ready.defaultInt!;
  }

  let players = 0;
  /**
   * The client's own player in a look, standing still: the slots as the
   * server sends them, and their stance playing as the secondary animation,
   * at its first frame.
   */
  function standing(entry: Look): StandingPlayer {
    const player = new ClientPlayer();
    player.ready = true;
    player.gender = entry.gender;
    player.appearance.set(toAppearance(entry, serverHides));
    player.colour.set(entry.colours);
    // The client caches built bodies by this key (`modelCache`); a key of
    // its own makes every look build afresh.
    player.baseId = BigInt(++players);
    const seq = serverStance(entry);
    player.readyanim = seq;
    player.secondaryAnim = seq;
    player.secondaryAnimFrame = 0;
    return player;
  }

  /**
   * The client's own figure for a look: `ClientPlayer.getTempModel2`, for a
   * player standing still, drawn at the figure's camera.
   */
  function reference(entry: Look, frame: Frame): Int32Array {
    const body = standing(entry).getTempModel2();
    if (!body) throw new Error("the client built no body");
    return drawModel(source, body, frame, FIGURE_CAMERA);
  }

  type Extent = { left: number; top: number; right: number; bottom: number };

  function measure(entry: Look): Extent | null {
    const pixels = reference(entry, PROBE);
    let extent: Extent | null = null;
    for (let y = 0; y < PROBE.height; y++) {
      for (let x = 0; x < PROBE.width; x++) {
        if (pixels[x + y * PROBE.width] === BACKGROUND) continue;
        if (x === 0 || y === 0 || x === PROBE.width - 1 || y === PROBE.height - 1) {
          throw new Error("a figure reached the edge of the probe box; make it bigger");
        }
        const dx = x - PROBE.originX;
        const dy = y - PROBE.originY;
        extent ??= { left: dx, top: dy, right: dx, bottom: dy };
        extent.left = Math.min(extent.left, dx);
        extent.right = Math.max(extent.right, dx);
        extent.top = Math.min(extent.top, dy);
        extent.bottom = Math.max(extent.bottom, dy);
      }
    }
    return extent;
  }

  /**
   * Size the frame from the figures themselves: every golden look fits
   * whole. Unlike a chathead's hats, nothing a body wears reaches far past
   * it — the tallest (a halberd's blade, a staff's head) stand some 80
   * pixels above the head, the widest (a square shield) 25 to its side — so
   * cutting the few that do would buy a frame barely smaller.
   */
  const bounds: Extent = { left: 0, top: 0, right: 0, bottom: 0 };
  for (const { look: entry } of golden) {
    const extent = measure(entry);
    if (!extent) continue;
    bounds.left = Math.min(bounds.left, extent.left);
    bounds.top = Math.min(bounds.top, extent.top);
    bounds.right = Math.max(bounds.right, extent.right);
    bounds.bottom = Math.max(bounds.bottom, extent.bottom);
  }

  // A pixel of air on every side.
  const frame: Frame = {
    width: bounds.right - bounds.left + 3,
    height: bounds.bottom - bounds.top + 3,
    originX: 1 - bounds.left,
    originY: 1 - bounds.top,
  };

  function hash(pixels: Int32Array): string | null {
    if (pixels.every((rgb) => rgb === BACKGROUND)) return null;
    return createHash("sha256")
      .update(new Uint8Array(pixels.buffer))
      .digest("hex")
      .slice(0, 16);
  }
  const goldenFile = golden.map(({ name, look: entry }) => ({
    name,
    look: entry,
    hash: hash(reference(entry, frame)),
  }));

  // --- write --------------------------------------------------------------

  writeFileSync(path.join(input.outDir, "public/game/chathead/bodies.bin"), bodiesBin);

  /**
   * One version for the renderer, `bodies.bin`, the tables and the frame
   * together: the page asks for `renderer.js` and `bodies.bin` with it, and
   * both are cached for a year.
   */
  const version = createHash("sha256")
    .update(readFileSync(path.join(input.outDir, "public/game/chathead/renderer.js")))
    .update(bodiesBin)
    .update(JSON.stringify(tables))
    .update(JSON.stringify(frame))
    .digest("hex")
    .slice(0, 8);

  const bodyTables: BodyTables = { version, ...tables };
  writeFileSync(
    path.join(input.outDir, "lib/chathead/bodies.json"),
    JSON.stringify(bodyTables) + "\n",
  );
  writeFileSync(
    path.join(input.outDir, "lib/chathead/figure.json"),
    JSON.stringify({ version, frame }, null, 1) + "\n",
  );
  // One look to a line: some fifteen hundred of them.
  writeFileSync(
    path.join(input.outDir, "lib/chathead/figure-golden.json"),
    `{"version":${JSON.stringify(version)},"looks":[\n` +
      goldenFile.map((entry) => JSON.stringify(entry)).join(",\n") +
      "\n]}\n",
  );

  return {
    version,
    models: models.size,
    bytes: bodiesBin.length,
    textures: [...textureIds].sort((a, b) => a - b),
    stances: Object.keys(frames).length,
    weapons: Object.keys(weapons).length,
    anims: anims.map((anim) => anim.length),
    objs: Object.keys(objs).length,
    hides: Object.keys(hides).length,
    frame,
    golden: goldenFile.length,
    drawn: goldenFile.filter((entry) => entry.hash !== null).length,
    /** The cache's frame total (R5): exportAnims must match this, so the
     * browser can init AnimFrame's table once for both bodies.bin and
     * anims.bin. */
    frameTotal,
    /** The tables as written, for `exportTurns` to build the scene looks with. */
    bodyTables,
    /** Every golden look, for `exportTurns` to measure standing at every facing. */
    looks: golden,
    /** The client's own player standing in a look, for `anims.ts` to play
     * an emote on for its reference pictures. */
    standing,
  };
}

// --- turning ----------------------------------------------------------------

/** Where a picture's pixels reach, relative to its frame's origin. */
type Reach = { left: number; top: number; right: number; bottom: number };

/** Grow `reach` to take in every pixel of a picture drawn in `PROBE`. */
function reachOf(reach: Reach, pixels: Int32Array): void {
  for (let y = 0; y < PROBE.height; y++) {
    for (let x = 0; x < PROBE.width; x++) {
      if (pixels[x + y * PROBE.width] === BACKGROUND) continue;
      if (x === 0 || y === 0 || x === PROBE.width - 1 || y === PROBE.height - 1) {
        throw new Error("a turned figure reached the edge of the probe box; make PROBE bigger");
      }
      reach.left = Math.min(reach.left, x - PROBE.originX);
      reach.right = Math.max(reach.right, x - PROBE.originX);
      reach.top = Math.min(reach.top, y - PROBE.originY);
      reach.bottom = Math.max(reach.bottom, y - PROBE.originY);
    }
  }
}

/** A picture's hash as the golden tests take it; null for a blank one. */
function pictureHash(pixels: Int32Array): string | null {
  if (pixels.every((rgb) => rgb === BACKGROUND)) return null;
  return createHash("sha256").update(new Uint8Array(pixels.buffer)).digest("hex").slice(0, 16);
}

/** The facings `turn-golden.json` checks: a quarter turn apart. */
const TURN_GOLDEN_FACINGS = [0, 4, 8, 12];

/** The widest turn frame the card's 280 px column holds, inside its box's border. */
const CARD_WIDTH = 278;

export type TurnInputs = {
  /** The client's source classes: the turned golden figures are the client's own. */
  source: Client;
  /** The tables as written (`exportBodies`), for the scene looks' poses. */
  bodyTables: BodyTables;
  /** Every golden look (`exportBodies`). */
  looks: readonly { name: string; look: Look }[];
  /** The client's own player standing in a look (`exportBodies`). */
  standing(look: Look): StandingPlayer;
  /** The emotes as `anims.json` has them (`exportAnims`): every frame a figure is posed in. */
  emotes: AnimTables["emotes"];
  /** `figure.json`'s version and frame, written again unchanged. */
  version: string;
  frame: Frame;
  outDir: string;
};

/**
 * The turn frame: the frame a turned figure is drawn in (`Figure` with a
 * `facing`), measured as the union over
 *
 * - every golden look standing, as the client draws it, at all sixteen
 *   facings, and
 * - the scene build's four reference looks (`scripts/scenes/looks.ts`) in
 *   every pose - standing and every emote frame - at all sixteen, drawn by
 *   the site's `buildBody` on the client's classes, as the scene build
 *   proves them,
 *
 * centred on the figure's axis, so turning never moves the figure
 * sideways, with a pixel of air on every side.
 *
 * It is written into `figure.json` beside `frame`, which is left as it
 * was, with the same `version`: the version is the hash of the renderer,
 * `bodies.bin`, the tables and `frame`, none of which changes, so every
 * golden keeps its version and every picture its hash. It exists to change
 * the year-long `/game/chathead` URLs, and nothing there changes; the turn
 * frame ships in the page's own bundle. `turn-golden.json` records the
 * frame its pictures were drawn in, and its test checks that against
 * `figure.json`.
 *
 * Runs after `exportAnims`, which leaves every anim file in the cache
 * unpacked, so the emote frames can be posed.
 */
export function exportTurns(input: TurnInputs) {
  const { source, standing } = input;
  const camera = (facing: number) => ({ ...FIGURE_CAMERA, yan: plainYaw(facing) });

  const reach: Reach = { left: 0, top: 0, right: 0, bottom: 0 };
  /** One built body drawn at every facing: drawing leaves the model as it was. */
  const everyFacing = (body: ClientModel) => {
    for (let facing = 0; facing < FACINGS; facing++) {
      reachOf(reach, drawModel(source, body, PROBE, camera(facing)));
    }
  };

  for (const { look } of input.looks) {
    const body = standing(look).getTempModel2();
    if (!body) throw new Error("the client built no body");
    everyFacing(body);
  }

  const poses = figurePoses(input.emotes);
  for (const { name, look } of LOOKS) {
    for (const { name: pose, pose: frame } of poses) {
      const body = buildBody(source, input.bodyTables, look, frame);
      if (!body) throw new Error(`${name} built no body in ${pose}: re-run npm run chathead:update`);
      everyFacing(body);
    }
  }

  const half = Math.max(-reach.left, reach.right);
  const turnFrame: Frame = {
    width: 2 * half + 3,
    height: reach.bottom - reach.top + 3,
    originX: half + 1,
    originY: 1 - reach.top,
  };

  // The golden figure's named looks - the defaults and the whole outfits -
  // a quarter turn apart, as the client draws them.
  const named = input.looks.filter(({ name }) => !/^(kit|colour|obj) /.test(name));
  const golden = named.flatMap(({ name, look }) =>
    TURN_GOLDEN_FACINGS.map((facing) => {
      const body = standing(look).getTempModel2();
      if (!body) throw new Error("the client built no body");
      return { name, look, facing, hash: pictureHash(drawModel(source, body, turnFrame, camera(facing))) };
    }),
  );

  writeFileSync(
    path.join(input.outDir, "lib/chathead/figure.json"),
    JSON.stringify({ version: input.version, frame: input.frame, turnFrame }, null, 1) + "\n",
  );
  writeFileSync(
    path.join(input.outDir, "lib/chathead/turn-golden.json"),
    `{"version":${JSON.stringify(input.version)},"frame":${JSON.stringify(turnFrame)},"looks":[\n` +
      golden.map((entry) => JSON.stringify(entry)).join(",\n") +
      "\n]}\n",
  );

  return {
    turnFrame,
    /** Whether the card's column holds it; the build says so if not. */
    fits: turnFrame.width <= CARD_WIDTH,
    sceneLooks: LOOKS.length,
    poses: poses.length,
    golden: golden.length,
  };
}
