import { notFound, permanentRedirect } from "next/navigation";

import { logHref } from "@/lib/adventurer-log/href";
import { nameFrom } from "@/lib/adventurer-log/name";

/**
 * `/hiscores/player/<name>` - where one player's hiscores used to be. The
 * Adventurer Log is the one player page now, and its Skills box (`#skills`)
 * has every skill with its rank, each linking into the table at that
 * player's row. So this answers 308 there, in the log's form of the name
 * (`Lynx%20Titan` -> `/adventurer/lynx_titan#skills`). A `profile` query is
 * dropped: only "main" is published. A name the game cannot hold is a 404,
 * as it is on the log.
 */
export default async function Player({ params }: PageProps<"/hiscores/player/[username]">) {
  const name = nameFrom((await params).username);
  if (!name) notFound();
  permanentRedirect(`${logHref(name)}#skills`);
}
