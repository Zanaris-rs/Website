/**
 * The handful of facts every page repeats: what the site is called, what
 * revision of the game it runs, and who to credit.
 *
 * They live in one module because they are the things most likely to be wrong
 * in three places at once — the fleet moves to a new revision, or the site is
 * renamed, and one page keeps the old value for a year.
 */

export const SITE_NAME = "Zanaris";

/**
 * The revision the fleet actually runs, not the newest one upstream has.
 * `ec2-setup/fleet.sh` pins `ENGINE_REVISION=274`; the engine branch is
 * `274-hosting` and the content branch is `274`. `scripts/update-worldmap.sh`
 * pins the matching client branch. Move all of them together.
 */
export const GAME_VERSION = { revision: 274, date: "November 24, 2004" };

/** The footer line under every page, in place of Jagex's 2004 copyright. */
export const PRESERVED_LINE =
  "Recreated by the Lost City team in 2023; rehosted and preserved by Zanaris since 2026.";

/** Our fork of the server, client and content. */
export const SOURCE_URL = "https://github.com/Zanaris-rs";

/**
 * Upstream: the people who wrote the server we run. Their GitHub organisation,
 * their own game site, and the two places they talk — which is where anyone
 * who wants to help should go, rather than to our fork.
 */
export const LOSTCITY_URL = "https://github.com/LostCityRS";
export const LOSTCITY_SITE_URL = "https://2004.lostcity.rs";
export const LOSTCITY_DISCORD_URL = "https://discord.lostcity.rs";
export const LOSTCITY_FORUMS_URL = "https://lostcity.rs";

/** The community wiki: guides, quests, calculators, an item database. */
export const LOSTHQ_URL = "https://2004.losthq.rs/";

/**
 * Zanaris Kit, our desktop client. The link is GitHub's list of releases, not
 * a file: a visitor sees the source and the release notes beside the
 * installers and picks the one for their system, rather than being handed an
 * unsigned installer straight from this site. `/releases` rather than
 * `/releases/latest`, because `latest` skips pre-releases.
 */
export const KIT_RELEASES_URL =
  "https://github.com/Zanaris-rs/Zanaris-kit/releases";

/** The rights holder in the assets and trademarks this project preserves. */
export const JAGEX_URL = "https://www.jagex.com/";

/** Shown on `/rules`; bump it whenever the wording there changes. */
export const RULES_UPDATED = "5th September 2026";

/**
 * The engine we run, by file, for `/economy/about`.
 *
 * The census page makes claims — that every save file is counted hourly, that
 * items conjured by staff are logged — and a claim about what a program does is
 * worth what the program is worth reading. These are the files that do it, on
 * the branch the fleet actually runs, so "here is how it works" can be a link
 * rather than an assurance.
 *
 * `ENGINE_BRANCH` is the same branch `GAME_VERSION` describes and
 * `ec2-setup/fleet.sh` pins. Move it with the others.
 */
export const ENGINE_URL = "https://github.com/Zanaris-rs/Engine-TS";
export const ENGINE_BRANCH = "274-hosting";

/** A file in the engine, on the branch the fleet runs. */
export function engineFile(path: string): string {
  return `${ENGINE_URL}/blob/${ENGINE_BRANCH}/${path}`;
}

/** The four files behind everything /economy says about itself. */
export const ENGINE_SOURCES = {
  census: "tools/server/SaveCensus.ts",
  counting: "tools/server/economy.ts",
  saves: "tools/server/SaveReader.ts",
  spawns: "src/engine/World.ts",
  sql: "prisma/postgres/migrations/4_evidence_and_records/migration.sql",
} as const;

/**
 * The day Zanaris opened, and the day the spawn log started with it.
 *
 * They are the same day on purpose: migration 4 created `staff_spawn` before
 * the first player logged in, so the log covers the whole of the server's life
 * and there is no stretch of it that went unrecorded. That is the only reason
 * `/economy` can say "nothing, ever" and mean it — a log that began later would
 * make the same sentence true and worthless.
 *
 * `content/news/2026-09-05-welcome-to-zanaris.md` is the other half of this
 * date; move them together.
 */
export const LAUNCHED = "2026-09-05";
