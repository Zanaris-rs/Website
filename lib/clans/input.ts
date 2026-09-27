import { checkText } from "@/lib/adventurer-log/format";

import { isCrest } from "./crests";
import { CLAN_LIMITS, clanNameOk, clanNameShapeOk } from "./names";
import { PERM_KEYS, type Perms } from "./ranks";
import { isClanWorld } from "./worlds";

/**
 * A clan write's input, checked before any SQL the way migration 17 will
 * check it. Text is trimmed and measured by `checkText`, whose sentence names
 * the field. A name, crest, world or threshold the database would refuse is
 * refused here with the database's own code, which the tab's messages
 * (`client.ts`) turn into a sentence. The database still checks everything.
 * Only the routes load this: it pulls in the item tables, through `isCrest`.
 */

export type ClanFields = { name: string; motto: string; crest: number; world: number | null; about: string };
export type NoticeInput = { title: string; body: string };
export type Checked<T> = { ok: true; value: T } | { ok: false; error: string };

const BAD_REQUEST = { ok: false, error: "bad_request" } as const;

/**
 * Start a clan (`"create"`: About starts empty) or save its page (`"page"`).
 *
 * Starting one applies the whole name rule, "Clan 123" included. A page save
 * checks the name's length and characters only: a clan staff renamed
 * "Clan <id>" may keep that name, and only the database knows whether the
 * name changed, so `clan_save_page` refuses a new reserved name itself
 * (`bad_name`).
 */
export function checkClanFields(raw: Record<string, unknown> | null, mode: "create" | "page"): Checked<ClanFields> {
  if (!raw) return BAD_REQUEST;

  const name = checkText(raw.name, "The clan's name", CLAN_LIMITS.name, { oneLine: true });
  if (!name.ok) return name;
  const nameOk = mode === "create" ? clanNameOk(name.value) : clanNameShapeOk(name.value);
  if (!nameOk) return { ok: false, error: "bad_name" };

  const motto = checkText(raw.motto ?? "", "The motto", CLAN_LIMITS.motto, { emptyOk: true, oneLine: true });
  if (!motto.ok) return motto;

  const crest = raw.crest;
  if (typeof crest !== "number" || !isCrest(crest)) return { ok: false, error: "bad_crest" };

  const asked = raw.world ?? null;
  let world: number | null = null;
  if (asked !== null) {
    if (!isClanWorld(asked)) return { ok: false, error: "bad_world" };
    world = asked;
  }

  let about = "";
  if (mode === "page") {
    const checked = checkText(raw.about ?? "", "About", CLAN_LIMITS.about, { emptyOk: true });
    if (!checked.ok) return checked;
    about = checked.value;
  }

  return { ok: true, value: { name: name.value, motto: motto.value, crest, world, about } };
}

/** The Leader's four "Who can…" levels, each 0 (Leader only) to 6 (every member). */
export function checkPermsInput(raw: Record<string, unknown> | null): Checked<Perms> {
  if (!raw) return BAD_REQUEST;
  const perms: Perms = { invite: 0, remove: 0, ranks: 0, page: 0 };
  for (const key of PERM_KEYS) {
    const level = raw[key];
    if (typeof level !== "number" || !Number.isInteger(level) || level < 0 || level > 6) {
      return { ok: false, error: "bad_perm" };
    }
    perms[key] = level;
  }
  return { ok: true, value: perms };
}

/** A notice: a one-line title, and a body that may run to a few lines. */
export function checkNoticeInput(raw: Record<string, unknown> | null): Checked<NoticeInput> {
  if (!raw) return BAD_REQUEST;
  const title = checkText(raw.title, "The notice's title", CLAN_LIMITS.noticeTitle, { oneLine: true });
  if (!title.ok) return title;
  const body = checkText(raw.body, "The notice", CLAN_LIMITS.noticeBody);
  if (!body.ok) return body;
  return { ok: true, value: { title: title.value, body: body.value } };
}
