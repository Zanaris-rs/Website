#!/usr/bin/env bash
#
# Rebuild what the site draws players with, from their look — a chathead,
# their head as a quest dialogue shows it, and a figure, their whole body
# standing as the world shows it:
#
#   public/game/chathead/renderer.js  the client's Model, Pix3D, Pix2D and AnimFrame
#   public/game/chathead/models.bin   every head model a look can use
#   lib/chathead/heads.json           kits, hats, what hides what, palettes
#   lib/chathead/golden.json          reference pictures for the golden test
#   public/game/chathead/bodies.bin   every body model, their textures, the stance frames
#   lib/chathead/bodies.json          kits, worn objects, what hides what, stances
#   lib/chathead/figure.json          the figure's frame, and the version
#   lib/chathead/figure-golden.json   reference figures for their golden test
#
# All of them are committed (and the outfit editor's tab, below). Re-run
# after a content bump, once the engine has been repacked, and commit the
# result; then `npm test` draws every golden look with the committed renderer
# and checks it pixel for pixel.
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
# drawing because it is the game's code. A figure is the same again for the
# whole body: every kit and worn object's model, posed in the first frame of
# the stance the player's weapon gives them (`AnimFrame`, which the renderer
# carries anyway for `Model.animate`, is exported for that).
#
# What the browser does not get is the client's config decoding: the build
# reads `idk.dat`, `obj.dat` and `seq.dat` here and writes the numbers a head
# or a body needs as JSON, and copies out only the models, textures and anim
# frames they use (a few hundred KB of the 38 MB cache). It also reads the
# *server's* `obj.dat` and `param.dat`, because the slots a worn object
# empties (a full helm's hair and jaw, a platebody's arms) and the stance a
# weapon gives (`ready_baseanim`) are never sent to the client.
#
# The reference pictures are drawn by the client's own `ClientPlayer.
# getHeadModel` and `getTempModel2`, not by the site's code, so the golden
# tests check the site's assembly, the exported tables and the bundled
# renderer together.

set -euo pipefail

cd "$(dirname "$0")/.."

source scripts/lib/client-ts.sh
ENGINE_DIR="${ENGINE_DIR:-../Server/engine}"
CONTENT_DIR="${CONTENT_DIR:-$ENGINE_DIR/../content}"

if ! command -v bun > /dev/null; then
  echo "error: bun is required to bundle and run the client's renderer (https://bun.sh)" >&2
  exit 1
fi

ensure_client_ts
(cd "$CACHE_DIR" && bun install --frozen-lockfile > /dev/null)

PACK="$ENGINE_DIR/data/pack"
for file in main_file_cache.dat client/config client/textures server/obj.dat server/param.dat; do
  if [ ! -f "$PACK/$file" ]; then
    echo "note     $PACK/$file is missing; packing the engine's data"
    npm --prefix "$ENGINE_DIR" run build
    break
  fi
done
for file in main_file_cache.dat client/config client/textures server/obj.dat server/param.dat; do
  if [ ! -f "$PACK/$file" ]; then
    echo "error: $PACK/$file still missing after a pack; check ENGINE_DIR" >&2
    exit 1
  fi
done
echo "pack     $PACK ($(date -r "$PACK/client/config" '+%Y-%m-%d %H:%M'))"

# The renderer: four of the client's classes and nothing else. The entry is
# written outside this repository and imports the clone by absolute path, so
# the `#/` imports inside the client resolve against its own package.json.
CLIENT_SRC="$(cd "$CACHE_DIR" && pwd)/src"
ENTRY_DIR="$(mktemp -d)"
trap 'rm -rf "$ENTRY_DIR"' EXIT
cat > "$ENTRY_DIR/renderer.ts" << EOF
export { default as Model } from "$CLIENT_SRC/dash3d/Model.ts";
export { default as Pix3D } from "$CLIENT_SRC/dash3d/Pix3D.ts";
export { default as Pix2D } from "$CLIENT_SRC/graphics/Pix2D.ts";
export { default as AnimFrame } from "$CLIENT_SRC/dash3d/AnimFrame.ts";
EOF

mkdir -p public/game/chathead
bun build "$ENTRY_DIR/renderer.ts" --minify --format esm --target browser \
  --outfile public/game/chathead/renderer.js > /dev/null
echo "renderer $(wc -c < public/game/chathead/renderer.js | tr -d ' ') bytes -> public/game/chathead/renderer.js"

CLIENT_DIR="$CACHE_DIR" ENGINE_DIR="$ENGINE_DIR" CONTENT_DIR="$CONTENT_DIR" OUT_DIR="." bun scripts/chathead/build.ts

echo
echo "sanity:"
echo "  no DOM in renderer: $(grep -c 'document\.\|window\.' public/game/chathead/renderer.js || true) (expect 0)"
echo "  client:             $CLIENT_COMMIT ($CLIENT_BRANCH)"
