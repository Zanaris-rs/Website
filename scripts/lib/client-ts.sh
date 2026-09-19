# Sourced, not run: a Client-TS checkout for the scripts that build from the
# game client's own code (`update-worldmap.sh`, `update-game-icons.sh`).
#
#   CLIENT_BRANCH    the client revision, default 274
#   CLIENT_REMOTE    our fork, tried first
#   CLIENT_FALLBACK  upstream, used when the fork lacks the branch
#   CACHE_DIR        where the clone lives, default .cache/Client-TS
#
# `ensure_client_ts` clones or refreshes it, then sets CLIENT_COMMIT.

# The fleet runs revision 274 (ec2-setup/fleet.sh ENGINE_REVISION=274), so
# everything taken from the client is taken from the matching branch. Move
# this with GAME_VERSION in lib/site.ts.
CLIENT_BRANCH="${CLIENT_BRANCH:-274}"
CLIENT_REMOTE="${CLIENT_REMOTE:-https://github.com/Zanaris-rs/Client-TS.git}"
CLIENT_FALLBACK="${CLIENT_FALLBACK:-https://github.com/LostCityRS/Client-TS.git}"
CACHE_DIR="${CACHE_DIR:-.cache/Client-TS}"

ensure_client_ts() {
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
}
