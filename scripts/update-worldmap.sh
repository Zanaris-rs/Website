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

# The fleet runs revision 274 (ec2-setup/fleet.sh ENGINE_REVISION=274), so the
# map applet is built from the matching client branch. Move this with
# GAME_VERSION in lib/site.ts.
CLIENT_BRANCH="${CLIENT_BRANCH:-274}"
CLIENT_REMOTE="${CLIENT_REMOTE:-https://github.com/Zanaris-rs/Client-TS.git}"
CLIENT_FALLBACK="${CLIENT_FALLBACK:-https://github.com/LostCityRS/Client-TS.git}"
ENGINE_DIR="${ENGINE_DIR:-../Server/engine}"
CACHE_DIR="${CACHE_DIR:-.cache/Client-TS}"

if ! command -v bun > /dev/null; then
  echo "error: bun is required to bundle the client (https://bun.sh)" >&2
  exit 1
fi

# --- the applet ---------------------------------------------------------

if [ -d "$CACHE_DIR/.git" ]; then
  echo "refresh  $CACHE_DIR"
  git -C "$CACHE_DIR" fetch --depth 1 origin "$CLIENT_BRANCH"
  git -C "$CACHE_DIR" checkout -q FETCH_HEAD
else
  mkdir -p "$(dirname "$CACHE_DIR")"
  if git clone --depth 1 --branch "$CLIENT_BRANCH" "$CLIENT_REMOTE" "$CACHE_DIR" 2> /dev/null; then
    echo "clone    $CLIENT_REMOTE ($CLIENT_BRANCH)"
  else
    # Our fork may not carry this branch yet; upstream always does.
    echo "note     $CLIENT_REMOTE has no branch $CLIENT_BRANCH, falling back"
    git clone --depth 1 --branch "$CLIENT_BRANCH" "$CLIENT_FALLBACK" "$CACHE_DIR"
    echo "clone    $CLIENT_FALLBACK ($CLIENT_BRANCH)"
  fi
fi

CLIENT_COMMIT="$(git -C "$CACHE_DIR" rev-parse HEAD)"
echo "client   $CLIENT_COMMIT"

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
