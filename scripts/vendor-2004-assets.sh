#!/usr/bin/env bash
#
# Vendor the 2004 page graphics into public/img.
#
# Most of the kit is recovered from the engine repo's git history: the website
# used to live in `Server/` and was moved out in commit f2c4d3ed, so the commit
# before it (`f2c4d3ed^`) is the last one that still carries `public/img/**`.
# Three tiles never existed in that tree (Lost City drew them for pages 2004
# never had) and are fetched from the live Lost City site instead.
#
# Re-runnable by design: a file that already exists is left alone and reported
# as "keep". That is what protects the seven images this repo already shipped,
# whose bytes differ from the history copies — re-encoding them would change
# the seams in the page chrome for no gain.
#
# Usage:  npm run assets:vendor            (ENGINE_DIR defaults to ../Server/engine)
#         ENGINE_DIR=/path/to/engine bash scripts/vendor-2004-assets.sh

set -euo pipefail

cd "$(dirname "$0")/.."

ENGINE_DIR="${ENGINE_DIR:-../Server/engine}"
REV="${REV:-f2c4d3ed^}"
LOSTCITY="${LOSTCITY:-https://2004.lostcity.rs/img}"

if [ ! -d "$ENGINE_DIR/.git" ]; then
  echo "error: ENGINE_DIR=$ENGINE_DIR is not a git repository" >&2
  echo "       point it at the engine checkout, e.g. ENGINE_DIR=~/Projects/2004scape/Server/engine" >&2
  exit 1
fi

recovered=0
fetched=0
kept=0
missing=0

# recover <path relative to public/img>
recover() {
  local path="$1"
  if [ -f "public/img/$path" ]; then
    echo "keep     public/img/$path"
    kept=$((kept + 1))
    return
  fi
  mkdir -p "public/img/$(dirname "$path")"
  git -C "$ENGINE_DIR" show "$REV:public/img/$path" > "public/img/$path"
  echo "recover  public/img/$path"
  recovered=$((recovered + 1))
}

# keep_only <path relative to public/img>
#
# For the graphics this repo committed itself. It never writes: the engine
# history holds a *different re-encode* of the same pictures, so restoring one
# from there would silently change the page chrome's seams. If one goes
# missing, that is a deleted file to recover from git, not from this script.
keep_only() {
  local path="$1"
  if [ -f "public/img/$path" ]; then
    echo "keep     public/img/$path"
    kept=$((kept + 1))
    return
  fi
  echo "WARNING  public/img/$path is missing; restore it with 'git checkout -- public/img/$path'." >&2
  echo "         It is deliberately not recovered from the engine history: those bytes differ." >&2
  missing=$((missing + 1))
}

# fetch <path relative to public/img>
fetch() {
  local path="$1"
  if [ -f "public/img/$path" ]; then
    echo "keep     public/img/$path"
    kept=$((kept + 1))
    return
  fi
  mkdir -p "public/img/$(dirname "$path")"
  # A plain curl is answered by Lost City today; the browser-ish User-Agent is
  # cheap insurance against that changing.
  curl -fsSL \
    -H 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36' \
    "$LOSTCITY/$path" > "public/img/$path"
  echo "fetch    public/img/$path"
  fetched=$((fetched + 1))
}

# The seven graphics this repo already shipped for the hiscores chrome. Listed
# so the manifest is complete, checked but never written: the committed bytes
# are the ones the chrome was built against.
for f in background2.jpg edge_a.jpg edge_c.jpg edge_d.jpg edge_g2.jpg edge_h2.jpg stoneback.gif; do
  keep_only "$f"
done

# The page chrome itself.
for f in blank.gif background.jpg nextpage.gif prevpage.gif; do
  recover "$f"
done

# The title page: the 9-slice stone frame, the menu tiles and the two hover
# highlights.
for f in \
  blank.gif \
  fm_top.gif fm_middle.gif fm_bottom.gif fm_top2.gif fm_bottom2.gif \
  fm_left.gif fm_right.gif \
  fm_topleft.gif fm_topright.gif fm_bottomleft.gif fm_bottomright.gif \
  mm_sword.jpg mm_player.jpg mm_chalice.jpg mm_scroll.jpg mm_rules.jpg \
  shinystonered.jpg ssredbright.jpg ssgreybright.png; do
  recover "title/$f"
done

# The twelve rule illustrations, 100x75 each.
for f in \
  lang itemscam passscam cheating impstaff sharing \
  macros multilog scamsite misuse noadv rule12; do
  recover "rules/$f.jpg"
done

# Never in the 2004 tree: Lost City drew these for pages 2004 did not have
# (Account Centre, Message Centre) and for its own world map tile.
for f in title/mm_security.jpg title/mm_message.jpg title/mm2_rs2b.jpg; do
  fetch "$f"
done

echo
echo "recovered $recovered, fetched $fetched, kept $kept"
if [ "$missing" -gt 0 ]; then
  echo "WARNING: $missing of this repo's own graphics are missing (see above)." >&2
fi
echo
echo "sanity:"
echo "  title tiles at 77x120: $(file public/img/title/*.jpg | grep -c 77x120) (expect 8)"
echo "  rule images at 100x75: $(file public/img/rules/*.jpg | grep -c 100x75) (expect 12)"
