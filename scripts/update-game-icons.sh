#!/usr/bin/env bash
#
# Rebuild the game icons the site shows next to item and skill names:
#
#   public/img/game/items/<id>.png     32x32, one per object id
#   public/img/game/skills/<stat>.png  25x25, one per engine stat id
#   lib/items/icons.json               which object ids have no icon
#
# All three are committed. Re-run after a content bump, once the engine has
# been repacked, and commit the result. `lib/items/icons.ts` and
# `lib/skills/icons.ts` are the only things that should build these paths.
#
# Usage:  npm run icons:update
#         ENGINE_DIR=/path/to/engine bash scripts/update-game-icons.sh
#
# --- where the pixels come from -----------------------------------------
#
# Skill icons are stored sprites: `staticons` and `staticons2` in the packed
# `media` archive, the ones the stats tab draws.
#
# Item icons are not stored anywhere. The 2004 client draws each one from the
# object's 3D model the first time an inventory shows it, with the object's
# own zoom, angles, recolours, outline and drop shadow, and a note drawn over
# its paper. So this script does exactly what the client does: it loads the
# revision-274 Client-TS source (the same clone update-worldmap.sh builds the
# map applet from) under bun and calls the client's own `ObjType.getSprite`
# on every object, fed from the engine's pack:
#
#   data/pack/client/{config,media,textures}   the jag archives
#   data/pack/main_file_cache.{dat,idx1}       the models
#
# The output is byte-for-byte deterministic, so an unchanged pack leaves
# `git status` clean. Nineteen objects draw as nothing in the client too —
# the content's invisible placeholder models — and are listed in icons.json
# rather than written as empty squares.

set -euo pipefail

cd "$(dirname "$0")/.."

source scripts/lib/client-ts.sh
ENGINE_DIR="${ENGINE_DIR:-../Server/engine}"

if ! command -v bun > /dev/null; then
  echo "error: bun is required to run the client's renderer (https://bun.sh)" >&2
  exit 1
fi

ensure_client_ts
(cd "$CACHE_DIR" && bun install --frozen-lockfile > /dev/null)

PACK="$ENGINE_DIR/data/pack"
if [ ! -f "$PACK/main_file_cache.dat" ] || [ ! -f "$PACK/client/config" ]; then
  echo "note     $PACK is missing; packing the engine's data"
  npm --prefix "$ENGINE_DIR" run build
fi
if [ ! -f "$PACK/main_file_cache.dat" ] || [ ! -f "$PACK/client/config" ]; then
  echo "error: $PACK still missing after a pack; check ENGINE_DIR" >&2
  exit 1
fi
echo "pack     $PACK ($(date -r "$PACK/client/config" '+%Y-%m-%d %H:%M'))"

CLIENT_DIR="$CACHE_DIR" ENGINE_DIR="$ENGINE_DIR" OUT_DIR="." bun scripts/game-icons/render.ts

echo
echo "sanity:"
echo "  item icons:  $(find public/img/game/items -name '*.png' | wc -l | tr -d ' ')"
echo "  skill icons: $(find public/img/game/skills -name '*.png' | wc -l | tr -d ' ') (expect 19)"
echo "  client:      $CLIENT_COMMIT ($CLIENT_BRANCH)"
