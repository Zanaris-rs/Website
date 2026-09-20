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

# Throw the clone away and say why. It is a disposable copy of someone else's
# repository in a gitignored directory, so re-cloning costs seconds and is the
# right answer whenever it is not the checkout we asked for.
discard_client_ts() {
  echo "note     $CACHE_DIR $1; re-cloning"
  rm -rf "${CACHE_DIR:?}"
}

ensure_client_ts() {
  if [ -d "$CACHE_DIR/.git" ]; then
    # A clone left from an earlier run can point somewhere else: a
    # CLIENT_REMOTE override outlives the invocation that set it, and a
    # remote can be renamed or deleted afterwards. Checking here turns that
    # into one line naming the clone, rather than a "Repository not found"
    # mid-build that reads as this repository's problem. Both ends of the
    # fallback are allowed, because a clone from upstream is a legitimate
    # result of the branch check below.
    local origin
    origin="$(git -C "$CACHE_DIR" remote get-url origin 2> /dev/null || true)"
    if [ "$origin" != "$CLIENT_REMOTE" ] && [ "$origin" != "$CLIENT_FALLBACK" ]; then
      discard_client_ts "points at ${origin:-no remote}, not $CLIENT_REMOTE"
    elif ! git -C "$CACHE_DIR" fetch --depth 1 origin "$CLIENT_BRANCH" 2> /dev/null; then
      # Unreachable remote, or a branch that has gone: same answer either way.
      discard_client_ts "could not fetch $CLIENT_BRANCH from $origin"
    else
      echo "refresh  $CACHE_DIR"
      git -C "$CACHE_DIR" checkout -q FETCH_HEAD
    fi
  fi

  if [ ! -d "$CACHE_DIR/.git" ]; then
    mkdir -p "$(dirname "$CACHE_DIR")"
    if git clone --depth 1 --branch "$CLIENT_BRANCH" "$CLIENT_REMOTE" "$CACHE_DIR" 2> /dev/null; then
      echo "clone    $CLIENT_REMOTE ($CLIENT_BRANCH)"
    else
      # Usually our fork not carrying this branch yet, which upstream always
      # does — but an unreachable remote lands here too, so the message says
      # what happened rather than why.
      echo "note     could not clone $CLIENT_BRANCH from $CLIENT_REMOTE, falling back"
      git clone --depth 1 --branch "$CLIENT_BRANCH" "$CLIENT_FALLBACK" "$CACHE_DIR"
      echo "clone    $CLIENT_FALLBACK ($CLIENT_BRANCH)"
    fi
  fi

  CLIENT_COMMIT="$(git -C "$CACHE_DIR" rev-parse HEAD)"
  echo "client   $CLIENT_COMMIT"
}
