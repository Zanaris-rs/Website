import "server-only";

import type { HeadTables } from "@/lib/chathead/head";
import heads from "@/lib/chathead/heads.json";
import { headOnly, type Look } from "@/lib/chathead/look";
import { query } from "@/lib/db";

import {
  defaultLooksStatement,
  gameLooksStatement,
  parseDefaultLooks,
  parseGameLooks,
} from "./queries";

/**
 * The look behind a name's chathead on a public page: their default outfit,
 * or, until they choose one, how they looked at their last save in the game.
 * A name with neither has no entry, and draws an empty frame.
 */

const tables = heads as HeadTables;

/** Each name's look from the game, cut down to what its chathead shows. */
export async function gameLooks(usernames: readonly string[]): Promise<Map<string, Look>> {
  const looks = new Map<string, Look>();
  if (usernames.length === 0) return looks;

  const statement = gameLooksStatement(usernames);
  for (const [username, look] of parseGameLooks(
    await query<Record<string, unknown>>(statement.text, statement.values),
  )) {
    looks.set(username, headOnly(look, tables));
  }
  return looks;
}

/** Each name's chathead look: the default outfit, else the game's. */
export async function chatheadLooks(usernames: readonly string[]): Promise<Map<string, Look>> {
  if (usernames.length === 0) return new Map();

  const statement = defaultLooksStatement(usernames);
  const looks = parseDefaultLooks(
    await query<Record<string, unknown>>(statement.text, statement.values),
  );

  const missing = usernames.filter((username) => !looks.has(username));
  for (const [username, look] of await gameLooks(missing)) {
    looks.set(username, look);
  }
  return looks;
}
