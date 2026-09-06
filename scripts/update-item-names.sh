#!/usr/bin/env bash
#
# Rebuild lib/items/names.json — the {id: name} table /economy uses so that no
# page ever shows a player a bare item id.
#
# Usage:  npm run items:update
#         CONTENT_DIR=/path/to/content bash scripts/update-item-names.sh
#
# --- where the ids come from --------------------------------------------
#
# The engine assigns object ids in exactly one place: `content/pack/obj.pack`,
# a plain `<id>=<debugname>` file that the packer reads as the authoritative
# id -> config-name map (`tools/pack/PackFile.ts`; `ObjConfig.packObjConfigs`
# walks `0 .. ObjPack.max` and looks each id's debugname up in it). Nothing
# else decides an id, which is why this script reads that file rather than
# unpacking `data/pack/server/obj.dat`: the .pack file is the source, the .dat
# is a build artefact of it, and reading the source needs no engine build.
#
# The names come from the `[debugname]` blocks in the content repo's `*.obj`
# configs, and are resolved with the packer's own three rules
# (`tools/pack/config/ObjConfig.ts:200-240`), so what we print is what the
# client prints:
#
#   1. `name=` in the config, when it has one.
#   2. no `name=` but a `model=`: the debugname with its first letter
#      capitalised and its underscores turned into spaces — the packer's own
#      fallback, which it writes into the config before encoding it.
#   3. `cert_<x>` has no config of its own. The packer synthesises one with
#      `certlink` pointing at `<x>`, and the client shows the linked object's
#      name. We take that name and mark it "(noted)", because two rows called
#      "Air rune" on a public page with different counts is a defect, and the
#      note is a different thing to own than the item.
#
# An object with neither a name nor a model is a placeholder the client never
# draws (eleven of them, `obj_599` and friends); those ids are left out, and
# `lib/items/names.ts` falls back to "Item <id>" for anything missing.
#
# --- duplicate names -----------------------------------------------------
#
# The 2004 data really does give several objects the same name: the three
# hallowe'en masks are all "Halloween mask", and an unstrung longbow is called
# "Longbow" like the strung one. A public table with two identical rows in it
# is unreadable, so a name shared by more than one id is qualified with
# whatever its debugname adds — "Halloween mask (green)", "Longbow (unstrung)",
# "Longbow (unstrung, noted)". The object a name was written for keeps it
# plain, so 995 is "Coins" while 617 (`fake_coins`) is "Coins (fake)"; twelve
# genuine duplicates in the cache (`bolt` and `bolts`) carry their whole
# debugname, because neither adds a word the other does not.
#
# How the split falls is printed by the run rather than written down here —
# "as the game names it" against "qualified by debugname" — because a content
# bump moves those two numbers and a comment cannot move with them. What is
# fixed is "labels shared: 0": every id ends up with a label of its own, which
# is the property `lib/items/names.test.ts` also asserts.
#
# Re-run after a content bump and commit the result.

set -euo pipefail

cd "$(dirname "$0")/.."

# The fleet runs revision 274 content (ec2-setup/fleet.sh ENGINE_REVISION=274).
# Move this with GAME_VERSION in lib/site.ts.
CONTENT_DIR="${CONTENT_DIR:-../Server/content}"
OUT="${OUT:-lib/items/names.json}"

if [ ! -f "$CONTENT_DIR/pack/obj.pack" ]; then
  echo "error: $CONTENT_DIR/pack/obj.pack is missing; set CONTENT_DIR" >&2
  exit 1
fi

mkdir -p "$(dirname "$OUT")"

node - "$CONTENT_DIR" "$OUT" <<'JS'
const fs = require('node:fs');
const path = require('node:path');

const [contentDir, out] = process.argv.slice(2);

/* --- ids: content/pack/obj.pack, `<id>=<debugname>` per line --- */

const debugnames = new Map();
const packText = fs.readFileSync(path.join(contentDir, 'pack/obj.pack'), 'utf8');
for (const line of packText.split('\n')) {
  const match = /^(\d+)=(\S+)$/.exec(line.trim());
  if (match) debugnames.set(Number(match[1]), match[2]);
}
if (debugnames.size === 0) {
  console.error('error: obj.pack parsed to nothing');
  process.exit(1);
}

/* --- names: every [debugname] block in every *.obj under the content repo --- */

function objFiles(dir, found = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) objFiles(full, found);
    else if (entry.name.endsWith('.obj')) found.push(full);
  }
  return found;
}

const configs = new Map();
for (const file of objFiles(contentDir)) {
  let current = null;
  for (const raw of fs.readFileSync(file, 'utf8').split('\n')) {
    const line = raw.trim();
    const header = /^\[(\S+)\]$/.exec(line);
    if (header) {
      current = { name: null, model: false };
      configs.set(header[1], current);
      continue;
    }
    if (!current) continue;
    if (line.startsWith('name=')) current.name = line.slice('name='.length).trim();
    else if (line.startsWith('model=')) current.model = true;
  }
}

/** The packer's rules 1 and 2. Null means "the client never names this one". */
function configName(debugname) {
  const config = configs.get(debugname);
  if (!config) return null;
  if (config.name) return config.name;
  if (config.model) {
    return debugname.charAt(0).toUpperCase() + debugname.slice(1).replace(/_/g, ' ');
  }
  return null;
}

const items = [];
for (const [id, debugname] of [...debugnames].sort((a, b) => a[0] - b[0])) {
  const noted = debugname.startsWith('cert_');
  const base = noted ? debugname.slice('cert_'.length) : debugname;
  const name = configName(base);
  if (name === null) continue;
  items.push({ id, base, name, noted });
}

/* --- qualify the names more than one id answers to --- */

const slug = (text) => text.toLowerCase().replace(/[^a-z0-9]/g, '');

const byName = new Map();
for (const item of items) {
  if (!byName.has(item.name)) byName.set(item.name, []);
  byName.get(item.name).push(item);
}

for (const [name, group] of byName) {
  const bases = [...new Set(group.map((item) => item.base))];
  if (bases.length < 2) continue;

  // Whatever the debugname says that the name does not: `halloweenmask_green`
  // against "Halloween mask" leaves "green".
  const nameSlug = slug(name);
  const qualifier = new Map();
  for (const base of bases) {
    const extra = base.split('_').filter((token) => token && !nameSlug.includes(slug(token)));
    qualifier.set(base, extra.join(' '));
  }

  // An empty qualifier is the *right* answer for the object the name was
  // written for: `coins` adds nothing to "Coins", while `fake_coins` adds
  // "fake", so 995 stays "Coins" and 617 becomes "Coins (fake)". Only when
  // two objects both add nothing (`bolt` and `bolts`) is there nothing to
  // choose between them, and then both carry their whole debugname.
  if (new Set(qualifier.values()).size !== bases.length) {
    for (const base of bases) qualifier.set(base, base.replace(/_/g, ' '));
  }

  for (const item of group) item.qualifier = qualifier.get(item.base);
}

/* --- write --- */

const names = {};
for (const item of items) {
  // One bracket, not two: "Longbow (unstrung, noted)".
  const extra = [item.qualifier, item.noted ? 'noted' : ''].filter(Boolean);
  names[item.id] = extra.length ? `${item.name} (${extra.join(', ')})` : item.name;
}

// One id per line: a 3883-entry object on one line is a diff nobody can read.
const lines = Object.entries(names).map(
  ([id, label]) => `  ${JSON.stringify(id)}: ${JSON.stringify(label)}`,
);
fs.writeFileSync(out, `{\n${lines.join(',\n')}\n}\n`);

const duplicates = items.length - new Set(Object.values(names)).size;
// `qualifier` is set only for an object whose name another id also answers to,
// so counting it here is exact. Counting brackets in the finished labels is
// not: plenty of 2004 names end in one of their own.
const qualified = items.filter((item) => item.qualifier).length;

console.log(`ids in obj.pack:    ${debugnames.size}`);
console.log(`obj configs read:   ${configs.size}`);
console.log(`names written:      ${items.length}`);
console.log(`unnamed (skipped):  ${debugnames.size - items.length}`);
console.log(`as the game names:  ${items.length - qualified}`);
console.log(`qualified:          ${qualified}`);
console.log(`labels shared:      ${duplicates} (expect 0)`);
console.log(`wrote ${out}`);
JS

echo
echo "sanity:"
node - "$OUT" <<'JS'
const path = require('node:path');
const names = require(path.resolve(process.argv[2]));
for (const id of [995, 1038, 1050, 1053, 1055, 1057, 962, 1959, 1961, 1052]) {
  console.log(`  ${id}: ${names[id]}`);
}
JS
