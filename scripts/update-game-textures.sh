#!/usr/bin/env bash
#
# Rebuild the game's textures as pictures an Adventurer Log's stylesheet can
# use (the settings page's "Insert a picture"):
#
#   public/img/game/textures/<id>.png  one per texture id, at its own size
#   lib/textures/textures.json         their version, names and sizes
#
# Both are committed. Re-run after a content bump, once the engine has been
# repacked, and commit the result. `lib/textures/textures.ts` is the only
# thing that should build these paths.
#
# Usage:  npm run textures:update
#         ENGINE_DIR=/path/to/engine bash scripts/update-game-textures.sh
#
# --- where the pixels come from -----------------------------------------
#
# The fifty textures the 2004 client paints walls, roofs, water and trees
# with are palette sprites in the packed `textures` archive. This script
# unpacks them with the client's own code (`Pix3D.unpackTextures`, from the
# same Client-TS clone the icons come from, under bun) and writes each texel
# as the client's rasteriser samples it: the palette after the client's
# brightness curve, with the client's own rule that a texel of 0 is a hole
# (a leaf's edge, a net's gaps), which the PNG keeps as transparency. Most
# of them - walls, roofs, water, leaves - tile without a seam, so they make
# repeating backgrounds as they are; the paintings and doors are single
# pictures.
#
# The names are the content's (`<content>/pack/texture.pack`, next to the
# engine as its build expects). Without them the picker shows numbers.
#
# The output is byte-for-byte deterministic, so an unchanged pack leaves
# `git status` clean.

set -euo pipefail

cd "$(dirname "$0")/.."

source scripts/lib/client-ts.sh
ENGINE_DIR="${ENGINE_DIR:-../Server/engine}"
CONTENT_DIR="${CONTENT_DIR:-$ENGINE_DIR/../content}"

if ! command -v bun > /dev/null; then
  echo "error: bun is required to run the client's texture code (https://bun.sh)" >&2
  exit 1
fi

ensure_client_ts
(cd "$CACHE_DIR" && bun install --frozen-lockfile > /dev/null)

PACK="$ENGINE_DIR/data/pack"
if [ ! -f "$PACK/client/textures" ]; then
  echo "note     $PACK is missing; packing the engine's data"
  npm --prefix "$ENGINE_DIR" run build
fi
if [ ! -f "$PACK/client/textures" ]; then
  echo "error: $PACK/client/textures still missing after a pack; check ENGINE_DIR" >&2
  exit 1
fi
echo "pack     $PACK ($(date -r "$PACK/client/textures" '+%Y-%m-%d %H:%M'))"

CLIENT_DIR="$CACHE_DIR" ENGINE_DIR="$ENGINE_DIR" CONTENT_DIR="$CONTENT_DIR" OUT_DIR="." \
  bun scripts/game-icons/textures.ts

echo
echo "sanity:"
echo "  textures: $(find public/img/game/textures -name '*.png' | wc -l | tr -d ' ') (expect 50)"
echo "  client:   $CLIENT_COMMIT ($CLIENT_BRANCH)"
