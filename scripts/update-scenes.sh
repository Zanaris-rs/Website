#!/usr/bin/env bash
#
# Pre-render the scenes a player's figure can stand in on the character
# card, with the game client's own World, ClientBuild, Pix3D and Model:
#
#   public/game/scenes/<key>.png     each spot's backdrop, 240x300, no one in it
#   lib/scenes/spots.json            each spot's eye and figure, and the version
#
# Both are committed. Re-run after a content bump (the map or its locs), once
# the engine has been repacked, and commit the result. Also writes
# scripts/scenes/contact-sheet.png, every spot with a figure in it, to judge
# the framing by eye; that is not committed.
#
# The spots are in scripts/scenes/spots.ts. The build fails, naming the spot,
# wherever a figure drawn over the backdrop would differ from one drawn in
# the scene: scripts/scenes/render.ts says why.
#
# Usage:  npm run scenes:update
#         ENGINE_DIR=/path/to/engine bash scripts/update-scenes.sh

set -euo pipefail

cd "$(dirname "$0")/.."

source scripts/lib/client-ts.sh
ENGINE_DIR="${ENGINE_DIR:-../Server/engine}"

if ! command -v bun > /dev/null; then
  echo "error: bun is required to run the client's World and ClientBuild (https://bun.sh)" >&2
  exit 1
fi

ensure_client_ts
(cd "$CACHE_DIR" && bun install --frozen-lockfile > /dev/null)

# The models (idx1), the anim frames (idx2) and the maps (idx4); the loc,
# floor and seq config; the textures; map_index and anim_index (versionlist);
# and the font the contact sheet is labelled in (title).
PACK="$ENGINE_DIR/data/pack"
FILES="main_file_cache.dat main_file_cache.idx1 main_file_cache.idx2 main_file_cache.idx4 client/config client/textures client/versionlist client/title"
for file in $FILES; do
  if [ ! -f "$PACK/$file" ]; then
    echo "note     $PACK/$file is missing; packing the engine's data"
    npm --prefix "$ENGINE_DIR" run build
    break
  fi
done
for file in $FILES; do
  if [ ! -f "$PACK/$file" ]; then
    echo "error: $PACK/$file still missing after a pack; check ENGINE_DIR" >&2
    exit 1
  fi
done
echo "pack     $PACK ($(date -r "$PACK/main_file_cache.dat" '+%Y-%m-%d %H:%M'))"

CLIENT_DIR="$CACHE_DIR" ENGINE_DIR="$ENGINE_DIR" OUT_DIR="." bun scripts/scenes/build.ts
echo "client   $CLIENT_COMMIT ($CLIENT_BRANCH)"
