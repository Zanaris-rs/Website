import type { Client, ClientModel } from "./client.ts";
import { KIT, OBJ, type Look, toAppearance } from "./look.ts";

/**
 * Everything the game's config says about heads, exported by
 * `scripts/update-chathead.sh` into `lib/chathead/heads.json`.
 */
export type HeadTables = {
  /** Changes whenever the renderer, the models or these tables do. */
  version: string;
  /**
   * Identity kits, indexed by kit id. `part` is the body part plus 7 for
   * female kits; `head` is the chathead models; `recol` its recolours.
   */
  kits: readonly {
    part: number;
    selectable: boolean;
    head: readonly number[];
    recol: readonly (readonly number[])[];
  }[];
  /** Objects with a chathead model (hats, helms), by object id. */
  objs: Readonly<
    Record<
      string,
      {
        man: readonly number[];
        woman: readonly number[];
        recol: readonly (readonly number[])[];
      }
    >
  >;
  /** Objects that empty appearance slots the head shows (`wearpos2/3`). */
  hides: Readonly<Record<string, readonly number[]>>;
  /** The body colour palettes: `recol1d[part][index]`, and the torso's second. */
  recol1d: readonly (readonly number[])[];
  recol2d: readonly number[];
  /**
   * The box every chathead is drawn in, and where the head's origin sits in
   * it. Every hair and beard fits whole, and nine hats in ten; the tallest
   * (the snelms' points, the Warrior helm's horns) are cut off at its edge.
   */
  frame: { width: number; height: number; originX: number; originY: number };
};

/** `IdkType.getHeadNoCheck`: a kit's head models, joined and recoloured. */
function kitHead(client: Client, tables: HeadTables, id: number): ClientModel {
  const kit = tables.kits[id];
  const parts = (kit?.head ?? []).map((model) => client.Model.load(model));
  const model = client.Model.combineForAnim(parts, parts.length);
  for (const [src, dst] of kit?.recol ?? []) model.recolour(src, dst);
  return model;
}

/** `ObjType.getHeadModelNoCheck`: a hat's head model for this gender, or none. */
function objHead(
  client: Client,
  tables: HeadTables,
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
    const second = client.Model.load(ids[1]);
    if (!second) return null;
    model = client.Model.combineForAnim([model, second], 2);
  }
  for (const [src, dst] of obj.recol) model.recolour(src, dst);
  return model;
}

/**
 * The head the client builds for a dialogue (`ClientPlayer.getHeadModel`),
 * unlit. Every kit slot contributes a model even when the kit has no head
 * models — an empty one — because the client does. With today's kits leaving
 * them out draws the same pixels (the golden test passes either way), but the
 * join settles face priority across every model it is handed, so the list is
 * kept exactly as the client makes it rather than relying on that. Returns
 * null when there is nothing to draw.
 */
export function buildHead(
  client: Client,
  tables: HeadTables,
  look: Look,
): ClientModel | null {
  const appearance = toAppearance(look, tables.hides);

  const models: ClientModel[] = [];
  let drawable = false;
  for (const value of appearance) {
    if (value >= KIT && value < OBJ) {
      const id = value - KIT;
      models.push(kitHead(client, tables, id));
      if ((tables.kits[id]?.head.length ?? 0) > 0) drawable = true;
    } else if (value >= OBJ) {
      const model = objHead(client, tables, value - OBJ, look.gender);
      if (model) {
        models.push(model);
        drawable = true;
      }
    }
  }
  if (!drawable) return null;

  const head = client.Model.combineForAnim(models, models.length);
  for (let part = 0; part < 5; part++) {
    const colour = look.colours[part] ?? 0;
    const palette = tables.recol1d[part];
    if (colour === 0 || !palette || colour >= palette.length) continue;

    head.recolour(palette[0], palette[colour]);
    if (part === 1 && colour < tables.recol2d.length) {
      head.recolour(tables.recol2d[0], tables.recol2d[colour]);
    }
  }
  return head;
}
