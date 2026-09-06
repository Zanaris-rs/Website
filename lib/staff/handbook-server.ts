import "server-only";

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { cache } from "react";

import { assembleHandbook, parseSection, type Handbook } from "./handbook";

/**
 * Reading the handbook off disk. Everything else about it is pure and lives in
 * `handbook.ts`; this is the half that touches the filesystem.
 *
 * Unlike news, it runs **on a request**. `/staff/handbook` is `force-dynamic`,
 * as every staff page is, because the gate re-reads the staff level from the
 * database each time — so there is no prerender to read the files during, and
 * `content/staff` is read per request instead. Next traces the directory into
 * the route's bundle the same way it traces `content/news` for the pages that
 * prerender from it; the build check for that is in the README.
 *
 * `React.cache` keeps one request from reading the directory once per section.
 * The reads are synchronous for the same reason `lib/news/index.ts`'s are: ten
 * small files off the same server, and an async version would be ten awaits
 * that finish in the same millisecond.
 *
 * It throws on a malformed section, and the page catches it. That is the whole
 * difference from news, where a malformed post fails the build: here it must
 * fail into a panel that says "unavailable" rather than a stack trace on a
 * moderator's screen.
 */

const HANDBOOK_DIR = join(process.cwd(), "content", "staff");

export const readHandbook = cache((): Handbook => {
  const files = readdirSync(HANDBOOK_DIR).filter((name) => name.endsWith(".md"));

  return assembleHandbook(
    files.map((file) =>
      parseSection(file, readFileSync(join(HANDBOOK_DIR, file), "utf8")),
    ),
  );
});
