#!/usr/bin/env bash
#
# Rebuild the two files /worldmap needs:
#
#   public/js/mapview.js   the map applet, bundled from the Client-TS source
#   public/worldmap.jag    the map data, packed by the engine from content
#
# Both are committed. The applet only changes when the client does; the jag
# goes stale whenever the content maps change, which is why this is a script
# and not a one-off — re-run it after a content bump and commit the result.
#
# Usage:  npm run worldmap:update
#         CLIENT_BRANCH=289 ENGINE_DIR=/path/to/engine bash scripts/update-worldmap.sh

set -euo pipefail

cd "$(dirname "$0")/.."

# The client branch, its remotes and the clone's location (CLIENT_BRANCH,
# CACHE_DIR, ...) are shared with update-game-icons.sh.
source scripts/lib/client-ts.sh
ENGINE_DIR="${ENGINE_DIR:-../Server/engine}"

if ! command -v bun > /dev/null; then
  echo "error: bun is required to bundle the client (https://bun.sh)" >&2
  exit 1
fi

# --- the applet ---------------------------------------------------------

ensure_client_ts

(cd "$CACHE_DIR" && bun install --frozen-lockfile && bun run bundle.ts)

mkdir -p public/js
cp "$CACHE_DIR/out/mapview.js" public/js/mapview.js
echo "wrote    public/js/mapview.js"

# --- the map data -------------------------------------------------------

JAG="$ENGINE_DIR/data/pack/mapview/worldmap.jag"
if [ ! -f "$JAG" ]; then
  echo "note     $JAG is missing; packing the engine's data"
  npm --prefix "$ENGINE_DIR" run build
fi
if [ ! -f "$JAG" ]; then
  echo "error: $JAG still missing after a pack; check ENGINE_DIR" >&2
  exit 1
fi
cp "$JAG" public/worldmap.jag
echo "wrote    public/worldmap.jag"

echo
ls -l public/js/mapview.js public/worldmap.jag
echo
echo "sanity:"
echo "  exports MapView: $(grep -c 'export{' public/js/mapview.js) (expect 1 or more)"
echo "  no Worker:       $(grep -c 'new Worker' public/js/mapview.js) (expect 0)"
echo "  client commit:   $CLIENT_COMMIT ($CLIENT_BRANCH)"
