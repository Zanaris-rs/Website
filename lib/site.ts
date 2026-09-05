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

/** The rights holder in the assets and trademarks this project preserves. */
export const JAGEX_URL = "https://www.jagex.com/";

/** Shown on `/rules`; bump it whenever the wording there changes. */
export const RULES_UPDATED = "5th September 2026";
