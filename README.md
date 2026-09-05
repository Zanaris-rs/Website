# Zanaris — the website

The front door for **Zanaris**, a free rehost of [Lost
City](https://github.com/LostCityRS) (2004scape) — the open-source recreation
of RuneScape as it was in 2004. It is a copy of the 2004 site's structure,
under our own name, and it is honest on its first screen about being a rehost
of somebody else's work with no connection to Jagex Ltd.

| Path | What is there |
| --- | --- |
| `/` and `/disclaimer` | the non-affiliation disclaimer; `/` is the front page, as it is on Lost City |
| `/title` | the main menu: the wordmark, the live player count, the latest news, and the four stone panels |
| `/news` | news posts, from Markdown files in `content/news` — plus `/news/page/N`, `/news/category/<cat>` and `/news/<slug>` |
| `/rules` and `/rules/original` | what the twelve rules mean here, and the twelve rules themselves |
| `/worldmap` | the 2004 map applet, drawn from the game's own map data |
| `/serverlist` | the world list: region, members or free, a live player count, and links into the client at high or low detail |
| `/hiscores` | rankings for Overall and each of the nineteen skills, plus `/hiscores/player/<username>` |
| `/register` | the **only** way to create an account, behind Cloudflare Turnstile and the database's own rate limits |
| `/messages` | a placeholder for the Message Centre, until it is built |

Built with Next.js 16 (App Router, TypeScript) and hosted on **Vercel**. It is
not a static export: the hiscores and registration routes run server-side and
talk to Supabase Postgres. Everything else prerenders, and `/title` is
regenerated every fifteen seconds for the player count.

## Running it

```sh
npm install
cp .env.example .env.local   # then fill it in; .env.local is never committed
npm run dev                  # http://localhost:3000
npm test                     # vitest, unit tests for everything under lib/
npm run lint                 # eslint
npm run typecheck            # tsc --noEmit
npm run build                # a real Next build
npm run db:check             # prove DATABASE_URL connects and is the right role
npm run assets:vendor        # re-vendor the 2004 graphics (see "2004 assets")
npm run worldmap:update      # rebuild the map applet and map data (see "World map assets")
```

Without a `DATABASE_URL` the site still runs: the hiscores API answers 503 and
the pages show "Hiscores unavailable". Registration answers 503 too — *after*
the Turnstile check, which fails first if no secret is set.

## Environment

`.env.example` is the complete list. In production these live in the Vercel
project settings, and nothing else is needed.

| Var | What |
| --- | --- |
| `DATABASE_URL` | Supabase Postgres as the `website` role, **transaction pooler, port 6543** |
| `TURNSTILE_SECRET_KEY` | server half of the Cloudflare Turnstile widget — **unset means registration is closed**, by design |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | *optional* — client half of the same widget. Site keys are public, so the live one is the shipped default (`lib/account/site-key.ts`); set this only to point the form at a different widget |
| `ALLOWED_TURNSTILE_HOSTNAMES` | *optional* — comma-separated hostnames a Turnstile challenge may have been solved on. Unset means the built-in list; an entry may start `*.` to match subdomains |
| `SITE_URL` | the site's own origin, e.g. `https://zanaris.rs` — `metadataBase` in `app/layout.tsx`, so relative metadata URLs resolve against the real host instead of Next's `localhost:3000` guess. Unset or malformed falls back to `https://zanaris.rs`. |
| `DATABASE_SSL_CA` | *optional* override for the vendored Supabase CA — see below |

Two details in `DATABASE_URL` are load-bearing:

- **The role must be `website`, not `postgres`.** `postgres` owns every table
  and bypasses RLS, so a bug in a route handler could read password hashes or
  set `staffmodlevel`. `website` has `SELECT` on two views and `EXECUTE` on two
  functions, and nothing else. `npm run db:check` fails if the role can read
  `public.account`, which is what catches this.
- **The port must be `6543`, not `5432`.** `5432` is session mode, one
  dedicated connection per client; serverless scales to many instances and
  would exhaust the free pooler budget. `6543` multiplexes — which is why
  `lib/db.ts` never uses a named prepared statement.

TLS is configured in `lib/db.ts` and deliberately not in the URL: `pg` only
turns it on when `ssl` is set or the URL carries `sslmode`, and a URL parameter
would override the object. The chain is **always verified** —
`rejectUnauthorized` is never false, because the same host and password reach a
`postgres` role that can read every password hash.

That needs a certificate the app ships with. The pooler presents
`CN=*.pooler.supabase.com` under a **self-signed** "Supabase Root 2021 CA" that
no public trust store carries, so it is vendored:

| | |
| --- | --- |
| `lib/supabase-root-2021.crt` | the certificate, for inspection and diffing |
| `lib/supabase-ca.ts` | the same PEM inlined, which is what actually ships |
| SHA-256 | `80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA` |
| Valid until | 2031-04-26 |

It is inlined as a string rather than read at runtime because a `readFileSync`
would depend on the file being traced into the serverless bundle, and a miss
shows up only as a connection failure in production.
`lib/supabase-ca.test.ts` asserts the two are byte-identical, that the PEM
parses, that its subject is `CN=Supabase Root 2021 CA`, and that the
fingerprint above still matches.

**This copy was captured from the live chain**, on 2026-09-04, with
`openssl s_client -connect aws-0-us-east-1.pooler.supabase.com:6543 -starttls
postgres -showcerts`, and confirmed to validate that chain as its sole trust
root. It is *not* a copy of Supabase's published file — compare it against
`prod-ca-2021.crt` from the dashboard (Settings → Database → SSL
configuration) before relying on it, and regenerate `lib/supabase-ca.ts` if
Supabase rotates the root. `DATABASE_SSL_CA` overrides the vendored copy, for a
rotation that has to land before a deploy can.

For local development, Cloudflare publishes
[test keys](https://developers.cloudflare.com/turnstile/troubleshooting/testing/):
`1x00000000000000000000AA` / `1x0000000000000000000000000000000AA` always pass,
and `2x0000000000000000000000000000000AA` always fails, which is the useful one
for checking the rejection path. They are **local dev only; never in
production** — an always-pass key is not a gate, it is the shape of one, and it
is why `.env.example` ships both Turnstile variables blank with the test keys
only in a comment. Nothing that can be pasted straight into a production
environment should be able to open the gate by accident.

The live widget exists, and its site key ships in `lib/account/site-key.ts`.
**`TURNSTILE_SECRET_KEY` in the Vercel project is the one thing that opens the
gate**: unset, every request ends in `400 { "error": "turnstile" }` before the
database is touched. That is the correct resting state, and it is also why a
deploy that "looks fine" proves nothing — the failure mode is a working page
whose every submission is refused. See below for how to tell the two apart.

## Registration, and how the gate is built

There is **no email verification** and therefore **no password reset**. The
email is metadata, not identity: it gives staff a contact address that is
probably real and makes lazy multi-accounting visible afterwards, but it proves
nothing and blocks nobody. A forgotten password can only be changed by staff
running the engine's `account.ts reset-password`. The register page says so.

That leaves Turnstile as the load-bearing half of the gate, so it **fails
closed**. Every one of these ends the request with `400 { "error": "turnstile" }`
before anything touches the database:

- no `TURNSTILE_SECRET_KEY` set;
- no token in the request body;
- siteverify returning a non-2xx, a malformed body, or `success: false`;
- a network error or a timeout reaching siteverify.

**With `TURNSTILE_SECRET_KEY` unset, every registration fails.** That is
deliberate — a misconfigured gate must not silently become no gate — but it
means the variable has to be set in Vercel before the site can create accounts,
and it is worth verifying in production rather than assuming.

### The Turnstile flow, end to end

Cloudflare's own [existing-widget
flow](https://developers.cloudflare.com/turnstile/), followed exactly, with
where each half lives here:

1. **The script.** `components/account/RegisterForm.tsx` loads
   `https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit`
   through `next/script`, and renders the widget itself once the script is
   ready. Explicit render rather than the implicit `data-*` markup, because the
   form has to know the moment a token arrives — see point 5.
2. **The site key.** `lib/account/site-key.ts`, overridable with
   `NEXT_PUBLIC_TURNSTILE_SITE_KEY`. Site keys are public — this one is in the
   HTML of `/register` for anyone to read — so shipping it costs nothing and
   saves the page from going blank over a missing variable.
3. **The action.** The widget renders with `action: "signup"`, the value of
   `TURNSTILE_ACTION`. The form imports that same constant from
   `lib/account/turnstile.ts`, so the label the widget mints and the label the
   server demands cannot drift apart.
4. **The token.** The widget's callback puts it in React state; the form posts
   it as `turnstileToken` (Cloudflare's own field name for the same thing is
   `cf-turnstile-response`).
5. **No token, no submit.** The button is disabled and says *Waiting for the
   anti-bot check…* until a token exists, and the expiry and error callbacks
   put it back to `null`. Posting without one is a certain 400, which reads to
   a player as "the check is broken" when the widget had merely not finished.
   `lib/account/submit.ts` holds that rule, because it is exactly the sort of
   thing that regresses in silence.
6. **Siteverify, server-side.** `lib/account/turnstile.ts` POSTs `secret`,
   `response` and `remoteip` to
   `https://challenges.cloudflare.com/turnstile/v0/siteverify` with a 5s
   timeout, and accepts only when **all three** hold:

   | | |
   | --- | --- |
   | `success` | is exactly `true` |
   | `action` | equals `signup` |
   | `hostname` | is on the approved list |

   The last two are the ones that are easy to leave out, and the reason they
   matter is point 2: because the site key is public, `success: true` on its
   own only proves that *somebody* solved *some* challenge for our widget.
   Someone can embed our site key on their own page, solve it there and post
   the token here — `hostname` is what makes that fail, and `action` is what
   stops a token minted for some other purpose being spent on an account.

   The approved list defaults to `zanaris.rs`, `www.zanaris.rs`,
   `zanaris.vercel.app`, `localhost` and `127.0.0.1`.
   `ALLOWED_TURNSTILE_HOSTNAMES` overrides it, comma-separated, and an entry
   may start `*.` to match subdomains — `*.vercel.app` for preview
   deployments. Unset means *the defaults*, never "allow anything": a variable
   nobody set must not be the thing that switches the check off.
7. **Reset after every submit.** Tokens are single-use, so the form calls
   `turnstile.reset(widgetId)` in a `finally` and clears its own state. A
   retry after a failure gets a fresh challenge rather than replaying a spent
   one.

#### Checking the secret is really set

The route answers `400 { "error": "turnstile" }` for *both* "no secret
configured" and "bad token", deliberately — the client learns nothing about
which. That also means **curl cannot tell you whether the secret is set**: a
dummy token gets the same 400 either way.

Two things that do distinguish them:

- **Against siteverify directly**, a dummy token and a *valid* secret returns
  `success: false` with `["invalid-input-response"]`, while a wrong or absent
  secret returns `["invalid-input-secret"]` or `["missing-input-secret"]`.
- **Through a real browser**, complete the widget on `/register` and submit. A
  200 proves the secret is valid, the action matches and the hostname is
  approved, all at once. Nothing short of a real browser mints a token that
  can prove it.

The rest of the checks, in the order the route runs them:

| Step | Rejects |
| --- | --- |
| `lib/account/validation.ts` | usernames outside `[A-Za-z0-9_ ]{1,12}`, names base37 cannot encode, `mod_*` and eight reserved staff words; passwords outside 8–20 printable ASCII |
| `lib/account/email.ts` | malformed addresses, ~8.7k disposable domains, domains with no MX record |
| `accounts.register(...)` | duplicate usernames (409) and the rate caps (429) — 3 per ip per 10 min, 10 per ip per day, 30 per /24 or /64 per day, charged for accounts created rather than calls made |

The rate limits are enforced **inside the SQL function**, in one statement and
one implicit transaction, so a malformed client cannot skip the counting by
calling things out of order — and a leaked `DATABASE_URL` can do nothing except
call that function.

`lib/account/email.ts` **fails open on resolver trouble**: NXDOMAIN or an empty
MX set rejects, but SERVFAIL or a timeout accepts. One flaky resolver must not
read as "nobody can sign up".

### The password contract

```
bcrypt(password.toLowerCase(), cost 10)
```

Identical in this repo and in `engine/`. `toLowerCase` because the 2004 login
protocol folds case; cost 10 and `bcrypt-ts` because the engine uses exactly
that. Get it wrong and every web-created account is unloggable, failing
*silently at login*, far from the code that caused it —
`lib/account/bcrypt-fixture.json` holds a hash generated by each side and
`lib/account/hash.test.ts` verifies both.

## Hiscores

Ranking is the game's own: `value DESC, date ASC, account_id ASC`, rank from
`row_number()`. `value` is XP times ten, so every display divides by ten and
floors. Names are stored base37-safe (`the_inducted`) and shown title-cased
with underscores as spaces (`The Inducted`); player links use the stored form.

Categories are `0` = Overall (from `hiscore_large`, type 0) and the skills
`1..18` and `21` (`19` and `20` are disabled stats and never appear).

A table shows a fixed 21-row window and there are no page links:

- no parameters → ranks 1–21;
- `rank=R` → `[max(1, R-20) .. max(21, R)]`, row R in yellow;
- `name=X` / `username=X` → the window containing X, X in yellow;
- an unknown name, or a rank past the end → an empty table, not an error.

Rows for banned accounts and staff above `staffmodlevel > 1` are excluded by
the database views, not here. A skill row only exists once the base level
reaches 15; Overall always exists.

## JSON contracts

### `worlds.json` (site root, written by the deploy script)

```json
[
  {
    "id": 1,
    "name": "World 1",
    "region": "US-East",
    "members": true,
    "url": "https://w1.04.zanaris.rs"
  }
]
```

`url` is the world's origin with no trailing slash. The site derives the client
links from it: `<url>/rs2.cgi` for high detail and `<url>/rs2.cgi?lowmem=1` for
low detail. `public/worlds.json` in this repo is only a sample so `npm run dev`
has something to show; the deploy overwrites it. If it is missing or malformed,
`/serverlist` shows "World list unavailable".

### `world.json` (served by each game world)

```json
{ "id": 1, "members": true, "players": 3, "maxPlayers": 150 }
```

Served with `Access-Control-Allow-Origin: *`. The world list requests it once
per world on load and again every 30 seconds, giving up after 5 seconds. The
players cell shows `...` while in flight, `3 / 150` on success, and `offline`
on any failure.

### `GET /api/hiscores`

`?profile=main&category=0&rank=500`, or `&name=` / `&username=`.

```json
{ "profile": "main", "category": 0,
  "rows": [{ "rank": 480, "username": "repose", "name": "Repose",
             "level": 1523, "xp": 41234567 }],
  "highlight": "smeltz" }
```

`highlight` is the username of the row to show in yellow, or `null`. 400 with
`{ "error": "bad_category" | "bad_rank" | "bad_name" | "bad_profile" }` on a
malformed request; 503 if the database is unreachable.

### `GET /api/hiscores/player/<username>`

`?profile=main`.

```json
{ "username": "detective", "name": "Detective",
  "skills": [{ "category": 0, "rank": 1, "level": 1872, "xp": 275552085 }] }
```

404 `{ "error": "not_found" }` when the player has no rows at all.

Both hiscores routes send `Cache-Control: public, s-maxage=60,
stale-while-revalidate=600` on success and `no-store` on an error.

### `POST /api/account/register`

```json
{ "username": "Bob Smith", "email": "bob@example.com",
  "password": "hunter22", "turnstileToken": "..." }
```

200 `{ "ok": true, "username": "bob_smith" }` — note the canonicalised name.
Otherwise 400 with an `error` code from the table above, 409 `username_taken`,
429 `rate_limited`, or 503 `unavailable`. Always `Cache-Control: no-store`.

## Deployment

Vercel, project `Zanaris-rs/Website`, functions pinned to `iad1` by
`vercel.json` so they run next to Supabase in us-east-1. Pushing to `main`
deploys; a pull request gets a preview deployment.

The worlds themselves are not here — they stay on the hub under
`*.04.zanaris.rs`, deployed by `Server/ec2-setup`.

**`www.zanaris.rs` 308s to the apex** (`redirects()` in `next.config.ts`,
matched on the `host` header). Both hostnames served the site directly, which
gives every page two URLs — a nuisance for canonical links, and a real problem
for the host-only session cookie the account login adds: a login on the apex
would be invisible on `www`, and a single link would silently sign the reader
out.

Almost everything is prerendered at build time. `/title` is the exception: it
is regenerated every fifteen seconds (`export const revalidate = 15`) because
of the live player count, which is the only thing on the site that changes on
its own. `public/worlds.json` is read at build time, so a world added by the
deploy script appears in `/title`'s count on the next deploy — `/serverlist`
fetches the file in the browser and picks it up immediately.

## Layout

| Path | What it is |
| --- | --- |
| `app/layout.tsx` | html/body shell, the title template, global CSS |
| `app/page.tsx`, `app/disclaimer/page.tsx` | the non-affiliation disclaimer |
| `app/title/page.tsx` | the main menu, ISR at 15s for the player count |
| `app/news/**` | the five news routes, all prerendered |
| `app/rules/page.tsx`, `app/rules/original/page.tsx` | the rules |
| `app/worldmap/page.tsx` | the map applet's page |
| `app/serverlist/page.tsx` | the world list |
| `app/hiscores/page.tsx` | `/hiscores` |
| `app/hiscores/player/[username]/page.tsx` | one player's hiscores |
| `app/register/page.tsx` | account registration |
| `app/messages/page.tsx` | the Message Centre placeholder |
| `app/api/hiscores/route.ts` | the table API |
| `app/api/hiscores/player/[username]/route.ts` | the personal API |
| `app/api/account/register/route.ts` | registration, Node runtime, `no-store` |
| `components/site/Frame.tsx` | the 2004 page chrome every page is inside |
| `components/site/Tile.tsx` | the one component allowed a bare `<img>` |
| `components/site/` | `TitleBox`, `Panel`, `StonePanel`, `StoneCaption`, `StoneButton`, `MenuTile`, `PageNav`, `Disclaimer` |
| `components/news/`, `components/rules/`, `components/worldmap/` | the list and post views, the rule card, the map canvas |
| `components/hiscores/` | the table, the personal page, the shared header |
| `components/account/RegisterForm.tsx` | the form, the Turnstile widget, the warnings |
| `components/WorldTable.tsx` | the world list itself |
| `lib/site.ts` | the site name, the revision, the credit line, the URLs |
| `lib/news/` | frontmatter and filename parsing, categories, pagination, dates, Markdown |
| `lib/title/` | the player-count sum and the sentence, and the server-side fetch |
| `lib/rules/original.ts` | the twelve rules as data |
| `lib/db.ts` | the one `pg.Pool`, and the only `query()` |
| `lib/base37.ts` | name encoding, ported from the engine's `util/JString.ts` |
| `lib/supabase-ca.ts`, `lib/supabase-root-2021.crt` | Supabase's root CA, so TLS is verified |
| `lib/hiscores/` | categories, formatting, params, SQL, response shapes |
| `lib/account/` | validation, email, IP grouping, Turnstile, bcrypt, the register call |
| `content/news/` | the news posts |
| `scripts/db-check.mts` | `npm run db:check` |
| `scripts/vendor-2004-assets.sh` | `npm run assets:vendor` |
| `scripts/update-worldmap.sh` | `npm run worldmap:update` |
| `public/img/` | the 2004 page graphics |
| `public/js/mapview.js`, `public/worldmap.jag` | the map applet and its data |
| `types/mapview.d.ts` | the one type the map applet needs, since it is loaded by URL |

Everything under `lib/` is pure and unit-tested (`lib/**/*.test.ts`); the route
handlers and components hold no logic worth testing on their own. Two fixture
files are cross-repo contracts rather than restatements of the code:
`lib/base37-fixture.json` was generated by running the engine's `JString.ts`,
and `lib/account/bcrypt-fixture.json` holds a hash from each repo.

Styling is plain CSS: `app/globals.css` (black, white 13px Arial, and nothing
else) and CSS modules alongside each component. There is no design system and
no colour variables — the palette is the 2004 one, written where it is used:
`components/site/Frame.module.css` holds the panel, the stone bezels and the
original's nine link colours, and `Site.module.css` holds the furniture built
from them. No webfonts, no CDNs, no analytics.

**Links in the chrome are plain `<a>` elements, never `next/link`.** The world
map applet reaches for its canvas the moment it is evaluated, so `/worldmap`
has to be a fresh document load; a client-side navigation into it would hand
the applet a page whose canvas does not exist yet.

## News authoring

A post is one Markdown file in `content/news`, named
`YYYY-MM-DD-lower-case-slug.md`, with exactly three frontmatter keys:

```markdown
---
title: Welcome to Zanaris
date: 2026-09-05
category: Website
---

The body, in Markdown.
```

- `date` **must** equal the date in the filename; the build fails if it does not.
- `category` must be one of **Game Updates**, **Website**, **Customer Support**,
  **Technical**, **Community** or **Behind the Scenes** — the six in
  `lib/news/categories.ts`, each with its own colour.
- The slug becomes the URL (`/news/<slug>`); `page` and `category` are reserved
  because `/news/page/2` and `/news/category/website` are real paths.
- Seventeen posts to a list page, newest first.

There is no database, no editor and no admin login: a post is a pull request.
Every news URL is prerendered at build time, so **nothing reads `content/` on a
request** — which also means a new post needs a deploy, and a malformed one
fails the build rather than rendering an empty page. `npm test` checks every
committed post the same way the build does, in a second rather than a minute.

**Markdown is rendered without sanitisation, deliberately.** Raw HTML in a post
is a feature — a table, a coloured span, an image at an exact size — and posts
are repo files reviewed like any other change. `lib/news/render.test.ts`
asserts that raw HTML passes through, so the decision cannot be reversed by
accident. If news ever becomes something a logged-in user can submit, that test
is the first thing that has to change.

## World map assets

`/worldmap` needs two files, both committed:

| File | Where it comes from |
| --- | --- |
| `public/js/mapview.js` | ~80 KB, bundled from the game client's own `src/mapview/MapView.ts` (`Zanaris-rs/Client-TS`, branch `274`, `bun run bundle.ts`) |
| `public/worldmap.jag` | ~425 KB, packed by the engine from the content maps (`engine/data/pack/mapview/worldmap.jag`) |

```sh
npm run worldmap:update          # ENGINE_DIR=../Server/engine, CLIENT_BRANCH=274
```

The script clones or refreshes the client into `.cache/` (gitignored), bundles
it with `bun`, and copies both files into `public/`. The client branch is
pinned to the revision the fleet runs — move it with `GAME_VERSION` in
`lib/site.ts` when the fleet moves.

**`worldmap.jag` goes stale.** It is a snapshot of the content maps at the
moment it was packed, so a content change that moves anything on the map will
not show here until someone re-runs the script and commits the result.

## 2004 assets

`public/img/` is the original 2004 site graphics — the page chrome, the stone
frame, the menu tiles, the twelve rule illustrations.

```sh
npm run assets:vendor            # ENGINE_DIR=../Server/engine
```

Most of them are recovered from the **engine repository's own git history**:
the website used to live in `Server/` and was moved out in commit `f2c4d3ed`,
so `f2c4d3ed^` is the last commit that still carries `public/img/**`. Three
tiles never existed in 2004 — `title/mm_security.jpg`, `title/mm_message.jpg`
and `title/mm2_rs2b.jpg`, drawn by [Lost City](https://2004.lostcity.rs/) for
pages 2004 did not have — and are fetched from the live Lost City site.

The script never overwrites: a file that is already there is reported as
`keep`. That is what protects the seven graphics this repo shipped before, whose
bytes differ from the history copies and which the chrome was built against.

The wordmark is ours: `public/img/title/logo.svg`, three stacked `<text>`
layers in a serif stack with a gold gradient, 312x100.
`public/img/title/logo.source.svg` is the same file kept as the editable
source — outlining the text to paths is optional polish for a machine with a
vector editor on it, and would only change how the wordmark renders where
Georgia is missing.

`public/img/` is the original 2004 site graphics as served by
[Lost City](https://2004.lostcity.rs/), a preservation project.
`lib/account/disposable-domains.json` is the
[disposable-email-domains](https://github.com/disposable-email-domains/disposable-email-domains)
blocklist, released under CC0-1.0. The server this site fronts is
[Lost City](https://github.com/LostCityRS)'s, MIT-licensed; our fork is at
[github.com/Zanaris-rs](https://github.com/Zanaris-rs).
