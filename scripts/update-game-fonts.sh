#!/usr/bin/env bash
#
# Rebuild the game's own b12 and p12 bitmap fonts as webfonts, from the
# client's own PixFont.depack out of the pack's `title` archive:
#
#   public/game/fonts/b12.ttf     the game's b12 font, as TrueType
#   public/game/fonts/p12.ttf     the game's p12 font, as TrueType
#   lib/game-chat/metrics.json    heights, advances, and sample widths
#                                 measured with PixFont.stringWid, which
#                                 metrics.test.ts holds lib/game-chat to
#
# All of them are committed. Re-run after a content bump, once the engine
# has been repacked, and commit the result.
#
# Usage:  npm run fonts:update
#         ENGINE_DIR=/path/to/engine bash scripts/update-game-fonts.sh

set -euo pipefail

cd "$(dirname "$0")/.."

source scripts/lib/client-ts.sh
ENGINE_DIR="${ENGINE_DIR:-../Server/engine}"

if ! command -v bun > /dev/null; then
  echo "error: bun is required to run PixFont.depack (https://bun.sh)" >&2
  exit 1
fi

ensure_client_ts
(cd "$CACHE_DIR" && bun install --frozen-lockfile > /dev/null)

PACK="$ENGINE_DIR/data/pack"
if [ ! -f "$PACK/client/title" ]; then
  echo "note     $PACK/client/title is missing; packing the engine's data"
  npm --prefix "$ENGINE_DIR" run build
fi
if [ ! -f "$PACK/client/title" ]; then
  echo "error: $PACK/client/title still missing after a pack; check ENGINE_DIR" >&2
  exit 1
fi
echo "pack     $PACK ($(date -r "$PACK/client/title" '+%Y-%m-%d %H:%M'))"

CLIENT_DIR="$CACHE_DIR" ENGINE_DIR="$ENGINE_DIR" OUT_DIR="." bun scripts/game-fonts/build.ts
