#!/usr/bin/env bash
#
# Rebuild what the site draws chatheads with — a player's head as a quest
# dialogue shows it, drawn from their look:
#
#   public/game/chathead/renderer.js  the client's Model, Pix3D and Pix2D
#   public/game/chathead/models.bin   every head model a look can use
#   lib/chathead/heads.json           kits, hats, what hides what, palettes
#   lib/chathead/golden.json          reference pictures for the golden test
#
# All four are committed. Re-run after a content bump, once the engine has
# been repacked, and commit the result; then `npm test` draws every golden
# look with the committed renderer and checks it pixel for pixel.
#
# Usage:  npm run chathead:update
#         ENGINE_DIR=/path/to/engine bash scripts/update-chathead.sh
#
# --- why the client's own code ---------------------------------------------
#
# A chathead is not a picture anywhere in the cache. In a dialogue the server
# says only "the player's head goes here" (`if_setplayerhead`), and the client
# builds the model from the player's hair, jaw and hat and draws it in
# software, every frame. So the site does exactly that, with the client's own
# renderer bundled from the same Client-TS clone the map applet and the item
# icons come from — about 16 KB gzipped, and pixel for pixel the game's
# drawing because it is the game's code.
#
# What the browser does not get is the client's config decoding: the build
# reads `idk.dat` and `obj.dat` here and writes the few hundred numbers a head
# needs as JSON, and copies out only the head models (a hundred-odd KB of the
# 38 MB cache). It also reads the *server's* `obj.dat`, because the slots a
# worn object empties (a full helm's hair and jaw) are never sent to the
# client.
#
# The reference pictures are drawn by the client's own `ClientPlayer.
# getHeadModel`, not by the site's code, so the golden test checks the site's
# head assembly, the exported tables and the bundled renderer together.

set -euo pipefail

cd "$(dirname "$0")/.."

source scripts/lib/client-ts.sh
ENGINE_DIR="${ENGINE_DIR:-../Server/engine}"

if ! command -v bun > /dev/null; then
  echo "error: bun is required to bundle and run the client's renderer (https://bun.sh)" >&2
  exit 1
fi

ensure_client_ts
(cd "$CACHE_DIR" && bun install --frozen-lockfile > /dev/null)

PACK="$ENGINE_DIR/data/pack"
for file in main_file_cache.dat client/config server/obj.dat; do
  if [ ! -f "$PACK/$file" ]; then
    echo "note     $PACK/$file is missing; packing the engine's data"
    npm --prefix "$ENGINE_DIR" run build
    break
  fi
done
for file in main_file_cache.dat client/config server/obj.dat; do
  if [ ! -f "$PACK/$file" ]; then
    echo "error: $PACK/$file still missing after a pack; check ENGINE_DIR" >&2
    exit 1
  fi
done
echo "pack     $PACK ($(date -r "$PACK/client/config" '+%Y-%m-%d %H:%M'))"

# The renderer: three of the client's classes and nothing else. The entry is
# written outside this repository and imports the clone by absolute path, so
# the `#/` imports inside the client resolve against its own package.json.
CLIENT_SRC="$(cd "$CACHE_DIR" && pwd)/src"
ENTRY_DIR="$(mktemp -d)"
trap 'rm -rf "$ENTRY_DIR"' EXIT
cat > "$ENTRY_DIR/renderer.ts" << EOF
export { default as Model } from "$CLIENT_SRC/dash3d/Model.ts";
export { default as Pix3D } from "$CLIENT_SRC/dash3d/Pix3D.ts";
export { default as Pix2D } from "$CLIENT_SRC/graphics/Pix2D.ts";
EOF

mkdir -p public/game/chathead
bun build "$ENTRY_DIR/renderer.ts" --minify --format esm --target browser \
  --outfile public/game/chathead/renderer.js > /dev/null
echo "renderer $(wc -c < public/game/chathead/renderer.js | tr -d ' ') bytes -> public/game/chathead/renderer.js"

CLIENT_DIR="$CACHE_DIR" ENGINE_DIR="$ENGINE_DIR" OUT_DIR="." bun scripts/chathead/build.ts

echo
echo "sanity:"
echo "  no DOM in renderer: $(grep -c 'document\.\|window\.' public/game/chathead/renderer.js || true) (expect 0)"
echo "  client:             $CLIENT_COMMIT ($CLIENT_BRANCH)"
