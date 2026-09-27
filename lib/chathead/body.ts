import type { Client, ClientModel } from "./client.ts";
import { type Camera, drawModel, type Frame } from "./draw.ts";
import { KIT, OBJ, type Look, toAppearance } from "./look.ts";

/**
 * A player's whole body, standing, as the client builds it for the world
 * (`ClientPlayer.getTempModel2`): every kit and every worn object's model
 * joined, recoloured, lit, and posed in the stance the player's weapon gives
 * them. `scripts/update-chathead.sh` exports what it needs into
 * `lib/chathead/bodies.json` and `public/game/chathead/bodies.bin`.
 */
export type BodyTables = {
  /** Changes whenever the renderer, `bodies.bin` or these tables do. */
  version: string;
  /**
   * Identity kits, indexed by kit id: `model` is the body models
   * (`IdkType.model`), `recol` the recolours the kit applies to them.
   */
  kits: readonly {
    model: readonly number[];
    recol: readonly (readonly number[])[];
  }[];
  /**
   * Every wearable object with a worn model, by object id: the models for
   * each gender in the order the client joins them (`manwear`, `manwear2`,
   * `manwear3`), how far each gender's is moved up or down (`offset`, man
   * then woman), and the object's recolours.
   */
  objs: Readonly<
    Record<
      string,
      {
        man: readonly number[];
        woman: readonly number[];
        offset: readonly number[];
        recol: readonly (readonly number[])[];
      }
    >
  >;
  /**
   * Every object that empties appearance slots (`wearpos2`/`wearpos3`), and
   * which: a platebody the arms, a two-handed sword the shield, a full helm
   * the hair and jaw. `heads.json` keeps only the slots a head shows.
   */
  hides: Readonly<Record<string, readonly number[]>>;
  /**
   * The stance: which `seq` the player stands in (`readyanim`), and the
   * frame of it they are drawn in. `default` is for no weapon or one with no
   * stance of its own; `weapons` maps a weapon to its own seq (the server
   * param `ready_baseanim`); `frames` maps each of those seqs to its first
   * frame.
   */
  stances: {
    default: number;
    weapons: Readonly<Record<string, number>>;
    frames: Readonly<Record<string, number>>;
  };
  /** The body colour palettes, as in `heads.json`. */
  recol1d: readonly (readonly number[])[];
  recol2d: readonly number[];
};

/**
 * The camera: the character design screen's model component
 * (`content/scripts/tutorial/interfaces/player_kit.if`, `com_90`:
 * `zoom=650 xan=150`). The design screen sways the model from side to side
 * (`Client.ts`, `CC_DESIGN_PREVIEW`: `yan` within ±256); a still picture
 * takes one angle in that sway, the one the dialogue turns the head to, so a
 * figure faces the same way as its chathead beside it.
 */
export const FIGURE_CAMERA: Camera = { zoom: 650, xan: 150, yan: 166 };

/** `IdkType.getModelNoCheck`: a kit's body models, joined and recoloured. */
function kitBody(client: Client, tables: BodyTables, id: number): ClientModel | null {
  const kit = tables.kits[id];
  if (!kit || kit.model.length === 0) return null;

  const parts = kit.model.map((model) => client.Model.load(model));
  // One model is used as it is; only two or more are joined.
  const model =
    parts.length === 1 ? parts[0] : client.Model.combineForAnim(parts, parts.length);
  for (const [src, dst] of kit.recol) model?.recolour(src, dst);
  return model;
}

/**
 * `ObjType.getWearModelNoCheck`: what an object looks like worn, on this
 * gender — its models joined, moved by its offset, and recoloured — or
 * nothing, for an object with no worn model (a ring, an arrow) or none for
 * this gender.
 */
function objBody(
  client: Client,
  tables: BodyTables,
  id: number,
  gender: number,
): ClientModel | null {
  const obj = tables.objs[id];
  if (!obj) return null;

  const ids = gender === 1 ? obj.woman : obj.man;
  if (ids.length === 0) return null;

  let model = client.Model.load(ids[0]);
  if (!model) return null;
  if (ids.length > 1) {
    const parts = [model, ...ids.slice(1).map((part) => client.Model.load(part))];
    if (parts.some((part) => !part)) return null;
    model = client.Model.combineForAnim(parts, parts.length);
  }

  const offset = obj.offset[gender] ?? 0;
  if (offset !== 0) model.translate(offset, 0, 0);
  for (const [src, dst] of obj.recol) model.recolour(src, dst);
  return model;
}

/**
 * The frame of the stance the look stands in. The server picks the stance
 * (`update_bas`, `content/scripts/player/scripts/appearance.rs2`): the
 * weapon's `ready_baseanim`, or `human_ready` with no weapon — which is also
 * the param's default. Standing still, the client plays it as the secondary
 * animation, and a still picture is its first frame, as the design screen
 * shows the player. -1 is no stance: the model as it was built.
 */
export function stanceFrame(tables: BodyTables, look: Look): number {
  const weapon = look.worn[3] ?? -1;
  const seq =
    weapon >= 0
      ? (tables.stances.weapons[weapon] ?? tables.stances.default)
      : tables.stances.default;
  return tables.stances.frames[seq] ?? -1;
}

/**
 * One frame of a seq a standing player plays (an emote) in place of their
 * stance: the frame id, and whether the seq empties either hand.
 */
export type Pose = { frame: number; hideLeft: boolean; hideRight: boolean };

/**
 * The body the client draws a standing player with
 * (`ClientPlayer.getTempModel2`), lit and posed, or null when there is
 * nothing to draw.
 *
 * With no `pose` the player stands in their stance. With one they play it
 * as their primary animation, as an emote plays. Their secondary animation
 * is then their `readyanim`, which the client leaves out
 * (`ClientPlayer.ts:433`), so the pose's frame is applied alone, with
 * `animate`, never `maskAnimate` (`:551`). A seq's `replaceheldright`
 * stands in for appearance slot 3 and its `replaceheldleft` for slot 5
 * (`:441`, `:446`, `:498`, `:502`); in this game's seqs it is only ever 0,
 * nothing, which is what `hideRight`/`hideLeft` say. The slots are emptied
 * after the server's own hiding, as the client replaces them in the
 * appearance it was sent.
 *
 * The result is the client's one scratch model (`Model.tempModel`), as it is
 * in the client: draw it before building another.
 */
export function buildBody(
  client: Client,
  tables: BodyTables,
  look: Look,
  pose?: Pose,
): ClientModel | null {
  const appearance = toAppearance(look, tables.hides);
  if (pose?.hideRight) appearance[3] = 0;
  if (pose?.hideLeft) appearance[5] = 0;

  const models: ClientModel[] = [];
  for (const value of appearance) {
    let model: ClientModel | null = null;
    if (value >= KIT && value < OBJ) {
      model = kitBody(client, tables, value - KIT);
    } else if (value >= OBJ) {
      model = objBody(client, tables, value - OBJ, look.gender);
    }
    if (model) models.push(model);
  }
  if (models.length === 0) return null;

  const body = client.Model.combineForAnim(models, models.length);
  for (let part = 0; part < 5; part++) {
    const colour = look.colours[part] ?? 0;
    const palette = tables.recol1d[part];
    if (colour === 0 || !palette || colour >= palette.length) continue;

    body.recolour(palette[0], palette[colour]);
    if (part === 1 && colour < tables.recol2d.length) {
      body.recolour(tables.recol2d[0], tables.recol2d[colour]);
    }
  }

  // Lit once, unposed — the client caches the body like this and poses a
  // copy of it every frame.
  body.prepareAnim();
  body.calculateNormals(64, 850, -30, -50, -30, true);

  const frame = pose ? pose.frame : stanceFrame(tables, look);
  const posed = client.Model.tempModel;
  // Only "no frame" leaves the alpha shared (`AnimFrame.animateTransparencies`):
  // a frame may fade faces, so the copy gets alpha of its own.
  posed.set(body, client.AnimFrame.animateTransparencies(frame));
  if (frame !== -1) posed.animate(frame);
  posed.calcBoundingCylinder();
  return posed;
}

/** A look's figure in a frame, or null when there is no body to draw. */
export function renderFigure(
  client: Client,
  tables: BodyTables,
  look: Look,
  frame: Frame,
): Int32Array | null {
  const body = buildBody(client, tables, look);
  if (!body) return null;
  return drawModel(client, body, frame, FIGURE_CAMERA);
}
