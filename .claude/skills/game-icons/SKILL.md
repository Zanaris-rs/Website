---
name: game-icons
description: Use when showing a RuneScape item or skill picture on the Zanaris website, turning an item id, stat id or hiscore category into an image URL, or refreshing the item/skill icons after a content bump, engine repack or new item ids.
---

# Game icons

## Overview

Every item and skill has a PNG drawn from the engine's packed cache by the
game client's own code (`scripts/update-game-icons.sh`). Pages never build
the paths themselves: they go through the helpers below, which know which
ids have no picture.

## Quick reference

| You have | On a page | As a URL (`string \| null`) |
| --- | --- | --- |
| item id (same id `itemName` takes) | `<ItemIcon id={id} />` 32px | `itemIconSrc(id)` — `lib/items/icons.ts` |
| stat id (engine `PlayerStat`, 0 Attack … 17 Thieving, 20 Runecraft) | `<SkillIcon stat={stat} />` 25px | `skillIconSrc(stat)` — `lib/skills/icons.ts` |
| hiscore category (stat + 1, 0 = Overall) | `<SkillIcon stat={statOfCategory(category)} />` | `skillIconSrc(statOfCategory(c) ?? -1)` |

- Components live in `components/game/`. They render through `Tile` (the only bare `<img>`), keep an empty square when there's no icon so columns line up, and take `size` (the hiscores use 16, the 2004 geometry).
- Files: `public/img/game/items/<id>.png`, `public/img/game/skills/<stat>.png`, `public/img/game/tiles/<name>.png`. `lib/items/icons.json` = `{ version, count, blank }` — ids past `count` or in `blank` have no file; `lib/skills/icons.json` = `{ version }`; `lib/title/tiles.json` = `{ version, names }`.
- **The helpers return a versioned URL** (`…/995.png?v=f205cfb4`), because `next.config.ts` caches `/img/game/*` for a year as `immutable`. A hand-written path has no `?v=` and is then cached for a year with no way to correct it. Strip the query only to touch the file on disk (`src.split("?")[0]`), never to render it.
- The 77x120 `/title` tiles are the third set: `TILES` in `render.ts` says which object each one poses, `titleTileSrc(name)` (`lib/title/tiles.ts`) gives `MenuTile` its URL.
- `null` means no picture (e.g. 1649 `invis_ring1`, an invisible placeholder). For a lone icon (not in a column), skip rendering on `null` instead of drawing the spacer. For anything leaving the site (CSV, email), resolve against the origin: `new URL(src, "https://zanaris.rs")`.

## Regenerating (content bump, new items, changed models)

Order matters — icons come from the engine's **pack**, names from **content**:

```bash
npm --prefix /Users/matthewgould/Projects/2004scape/Server/engine run build
CONTENT_DIR=/Users/matthewgould/Projects/2004scape/Server/content npm run items:update
ENGINE_DIR=/Users/matthewgould/Projects/2004scape/Server/engine npm run icons:update
npm test
```

- In a worktree the scripts' `../Server/...` defaults point at nothing — always pass the absolute dirs.
- `icons:update` packs only if the pack is *missing*; a stale pack silently gives old icons. Check its `pack … (date)` line is after the content change.
- It needs `bun`; it clones Client-TS 274 into `.cache/` (ignored).
- A `warning … past the pack's N objects` line means names.json is newer than the pack: repack, re-run.
- Output is deterministic: an unchanged pack leaves `git status` clean. Commit `public/img/game/`, `lib/items/icons.json` and the `lib/items/*.json` from `items:update`.

## Common mistakes

- Passing a hiscore category as a stat id: off by one skill. Use `statOfCategory`.
- Hand-writing `/img/game/items/${id}.png`: 404s for blank ids. Use `itemIconSrc`.
- `next/image`: re-encodes and resizes pixel art. Use the components (they use `Tile`).
- Editing a PNG by hand: the next regeneration overwrites it. Change `scripts/game-icons/render.ts` instead (e.g. its `WEB_COLOURS` recolour of the black Agility/Thieving silhouettes).
- Expecting stack variants: icons are the count-1 look (one coin for 995).
