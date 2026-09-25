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
| `/register` | a closed door: paste an invite code and continue to `/join/<code>` |
| `/join/<code>` | the actual registration form, behind Cloudflare Turnstile and the database's own rate limits |
| `/account/login` | the login box: a bcrypt salt handshake, so the site never sees a password hash |
| `/account` | the account centre: status, recent game logins, the citizen number, and the two things the owner can change |
| `/messages` | a placeholder for the Message Centre, until it is built |

Built with Next.js 16 (App Router, TypeScript) and hosted on **Vercel**. It is
not a static export: the hiscores, registration and account routes run
server-side and talk to Supabase Postgres. Everything under `/account`
additionally reads a signed session cookie, so it renders per request, and so
does `/title`, which reads the cookie to decide whether to show staff their
inbox link; its world polls are cached for fifteen seconds. The rest prerenders.

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
npm run icons:update         # redraw the item and skill icons from the cache (see "Game icons")
npm run chathead:update      # rebuild the chathead renderer and its data (see "Chatheads")
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
| `SESSION_SECRET` | the key the website session cookie is signed with — **unset (or under 32 characters) means nobody can log in**, by design |
| `DATABASE_SSL_CA` | *optional* override for the vendored Supabase CA — see below |

Two details in `DATABASE_URL` are load-bearing:

- **The role must be `website`, not `postgres`.** `postgres` owns every table
  and bypasses RLS, so a bug in a route handler could read password hashes or
  set `staffmodlevel`. `website` has `SELECT` on two views and `EXECUTE` on
  forty-two `accounts.*` functions, and nothing else — no table privilege at
  all. `npm run db:check` fails if the role can read `public.account`,
  `public.login_attempt`, `public.session`, `public.account_login`, the
  Message Centre's own five — `public.account_message`, `public.ticket`,
  `public.ticket_message`, `public.staff_action` and `public.report` — or the
  four behind `/bans` and `/economy`: `public.punishment`,
  `public.staff_spawn`, `public.economy_snapshot` and `public.economy_flow`.
  It fails too if the role can execute `accounts.throttled` /
  `accounts.record_failure`, which is what catches this.
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
for checking the rejection path.

**The test keys cannot get past this codebase, and that is not a bug.** Their
`siteverify` reply is a canned one:

```json
{ "success": true, "hostname": "example.com",
  "metadata": { "result_with_testing_key": true } }
```

It reports `example.com` and carries **no `action` field at all**, so both of
the checks above reject it. Setting `ALLOWED_TURNSTILE_HOSTNAMES=example.com`
fixes the hostname half; nothing fixes the action half, because there is
deliberately no way to switch that check off. So `/register` and
`/account/login` answer `400 turnstile` locally under the test keys, and the
only way to drive either form end to end on a developer machine is with the
real widget's keys — which means the owner adding `localhost` to the widget's
allowed domains. Everything behind the gate (the salt handshake, the session
cookie, the rate limits, the two change routes) is reachable without it: only
`login` and `register` carry a Turnstile check.

The test keys are **local dev only; never in production** — an always-pass key
is not a gate, it is the shape of one, and it is why `.env.example` ships both
Turnstile variables blank with the test keys only in a comment. Nothing that
can be pasted straight into a production environment should be able to open the
gate by accident.

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
| `accounts.register_with_invite(...)` | a live single-use invite (409 `invite_*` otherwise), duplicate usernames (409) and the rate caps (429) — 3 per ip per 10 min, 10 per ip per day, 30 per /24 or /64 per day, charged for accounts created rather than calls made, plus 30 bad invite codes per ip per 15 min |

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

## Login and the account centre

`/account/login` signs a player in; `/account` shows the account, its status
and its recent game logins; `/account/password` and `/account/email` change
the two things the owner can change. All four are dynamic, `no-store`, and
inside the same 2004 chrome as everything else.

### The salt handshake

The website never receives a password hash, and a plaintext password never
reaches Postgres. Both halves of that are deliberate, and both alternatives
were considered and rejected:

- **Send the plaintext to a SQL function and compare it there.** Simplest, and
  wrong: the password would be in the statement, so it would be in Supabase's
  query logs, in `pg_stat_statements`, and in any error the pooler reports. A
  password that has been written to a log is a password that has leaked.
- **Give the `website` role a view over `account.password` and compare in
  Node.** Then a leaked `DATABASE_URL` is a dump of every password hash. The
  whole point of the least-privilege role is that it cannot do this.

What ships is neither:

1. `accounts.password_salt(name)` returns the **29-character bcrypt prefix** of
   the stored hash — the algorithm, the cost and the salt. A salt is public by
   construction; it sits in the clear in front of every bcrypt hash ever made.
2. The site computes `bcrypt(lower(password), salt)` with `bcrypt-ts`, whose
   `hash(pw, salt)` accepts a salt string. That is exactly what `compare` does
   internally, which is what makes this possible at all.
3. `accounts.login(name, candidate, ip)` compares the 60 characters in the
   database and answers `ok` / `bad_credentials` / `rate_limited`.

So the site sees a salt and a candidate it computed itself, and the database
sees a hash. Neither side sees a password it did not already have.

**An unknown username gets a fake salt.** `fakeSalt` (`lib/account/salt.ts`) is
an HMAC-SHA256 of the name under `SESSION_SECRET`, encoded in bcrypt's own
base64 alphabet and labelled `$2b$10$`. Without it the endpoint would be a
username oracle by timing alone: a real name costs one bcrypt at cost 10
(~60 ms) and a made-up one costs nothing. With it both cost the same and both
answer `bad_credentials`. It is keyed by the secret so the set of fake salts
cannot be precomputed, and deterministic in the name so a repeated probe cannot
be told from a real account by watching the answer change.

A stored password that is not bcrypt-shaped — a hand-edited row — takes the
fake path too, and logs.

### The session cookie

`zanaris_session`, `HttpOnly; Secure` (production only); `SameSite=Lax;
Path=/; Max-Age=604800`, and **no `Domain`**, so it is host-only. There is no
session table: the cookie is a base64url JSON payload and an HMAC-SHA256 of it.

```json
{ "v": 1, "u": "bob_smith", "sv": "3f2a…", "iat": 1788000000, "exp": 1788604800 }
```

- `u` is the canonical username. **`staffmodlevel` is never in the cookie**;
  `/account` re-reads it from `accounts.profile` on every request, so a forged
  or stale cookie cannot promote anybody.
- `sv` is the first 16 hex characters of `sha256(current bcrypt salt)`.
  Changing a password changes the salt, so every cookie minted under the old
  one stops matching and `/account` bounces it to the login form. That is the
  only revocation a stateless session has, and it is the one that matters: the
  password change signs every *other* device out and re-mints the caller's own
  cookie so they stay in.
- `exp` is enforced here, not just by the browser's `Max-Age`, and a payload
  claiming a span longer than seven days is refused outright.

Signatures are compared with `timingSafeEqual`. Every failure — no cookie, a
forged one, an expired one, a wrong payload version — is the same `null`.

**`SESSION_SECRET` unset means the whole feature is off.** `/api/account/login`
answers `503 unavailable` and every account page redirects to the login form.
There is no default and no fallback, because a signing key with a default is a
signing key anyone can forge against. Rotating it logs everybody out at once,
which is the emergency stop if one leaks.

What it does *not* do is revoke a cookie somebody has already captured:
stateless sessions cannot be recalled. `HttpOnly` and the seven-day cap bound
that, and swapping in a database of live sessions later means changing
`lib/account/session-server.ts` and nothing else.

### CSRF

Two locks. `SameSite=Lax` keeps the cookie off a cross-site POST, so such a
request arrives unauthenticated. On top of that every mutating route checks the
`Origin` header against `x-forwarded-host ?? host` and answers `403 origin` on
a mismatch — **including when `Origin` is missing or the literal `null`**. A
browser always sends one on a POST; a request without one is not a browser, and
this site has no non-browser clients.

Logout is a POST for the same reason: a GET that signs you out is a logout
CSRF, doable with an `<img src>` on any page the reader visits.

### Rate limits

They live in SQL, in `accounts.throttled`, and count **failures only**: 10 per
username and 20 per IP per 15 minutes, shared by login, change-password and
change-email. A successful login costs nothing, so a player who mistypes twice
and then gets it right has spent two of ten, not three.

`website` is deliberately **not** granted `accounts.throttled` or
`accounts.record_failure`, and has no privilege on `login_attempt`: the site
can neither read the counter nor clear it. `accounts.reap()` sweeps rows older
than an hour, hourly, under pg_cron.

Ten failures lock a username out of *website* login for fifteen minutes. Game
login is unaffected. The error copy says exactly that: "Too many attempts. Wait
15 minutes."

### Bans, mutes and what the site still lets you do

**A banned or muted account can still log in to the website**, and the account
centre shows the restriction rather than hiding it. This is the point: somebody
who cannot play is precisely who needs to read why, and who the Message Centre
exists for. Only live restrictions are shown — an expired ban is not a
ban, and the row keeps its date forever.

### Recent logins

`accounts.recent_logins` returns the last ten rows of `public.session` for the
account, with the world and the IP address the game saw. They are the owner's
own addresses, shown unmasked, which is what makes "that login is not me"
answerable. The page says what to do about it: change the password, which also
signs every other device out.

### Applying a migration to Supabase

Migrations live in the **engine** repo (`engine/prisma/postgres/migrations`)
because that is where the schema is owned; the website only ever calls the
functions they create. Prisma is never run against this database. The
procedure, from `Server/ec2-setup`:

```sh
PGSSLMODE=verify-full PGSSLROOTCERT=ec2-setup/supabase-ca.crt \
  psql "postgresql://postgres.<ref>@aws-0-us-east-1.pooler.supabase.com:5432/postgres" \
  -v ON_ERROR_STOP=1 -f engine/prisma/postgres/migrations/<name>/migration.sql
```

as `postgres` over the **session** pooler on 5432 (DDL wants one backend), with
the password from `fleet.secrets.sh` and never on the command line. Then insert
the `_prisma_migrations` row with the sha256 of the file, check `\df accounts.*`
and that `select jobname from cron.job` still lists `reap`, and record it in
`ec2-setup/LOG.md`.

`npm run db:check` is the website's half of the proof, run with the `website`
URL: it asserts that the twenty tables are refused, that the forty-two
granted functions are executable and the seven withheld ones are not, and then
calls every one of those functions once against a username nobody has. None of those
calls writes a row -- `ticket_open` and `ticket_reply` resolve the username
before anything else and answer `invalid`/`not_found`, `staff_reply` and
`staff_notice` check `is_staff` first and answer `forbidden` -- so it is safe
to run against production, and a `RETURNS TABLE` shape that had drifted from
what `lib/` builds fails there rather than on a page.

## The Message Centre and the staff inbox

Everything addressed to an account arrives in one place: the welcome message
written when the account is registered, notices a moderator sends, the ban and
mute notices the **engine** writes when a staff member uses `::ban` or
`::mute`, and staff replies to tickets. `/messages` lists them unread first;
`/messages/<id>` opens one; `/messages/new` opens a ticket; and
`/messages/tickets/<id>` is the thread, with a reply box while it is open.

### One unread rule, in three places

```sql
count(*) from account_message where account_id = $1 and read_at is null
```

The engine's login server counts exactly that over Kysely and sends the number
to the client's welcome screen ("you have 1 unread message"). `accounts.unread`
counts exactly that after resolving a username. This site counts it for the
Account Centre link and derives it from the rows on `/messages`. If the three
ever drift, a player sees a number in game that the site cannot explain and
**nothing anywhere throws** — so the rule is pinned in
`lib/account/message-centre-contract.json`, a byte-for-byte copy of the
engine's `test/fixtures/message-centre-contract.json`, and
`lib/account/contract.test.ts` writes every value in it out by hand so that
re-copying the fixture fails a test rather than shipping quietly.

The same fixture carries the caps — subject 120, body 4000, 5 tickets per
account per day, 20 replies per hour, 20 notices per hour — and
`lib/messages/format.ts` **reads** them from it rather than repeating them. The
SQL in `3_message_centre` is the authority and would refuse the same inputs on
its own; what the app-side check adds is a sentence naming the field, which
`invalid` cannot.

### Two GETs that write

`accounts.message` and `accounts.ticket_thread` mark what they return as read.
That is deliberate — opening a message *is* reading it, and there is nothing
else on the page to press — and it is why `/messages/<id>`,
`/messages/tickets/<id>` and their routes are `force-dynamic` with
`Cache-Control: no-store`. A cached render would be a message that never gets
marked read and an in-game unread count that never goes down.

`accounts.staff_thread` marks nothing read, on purpose: the unread flags belong
to the player, and a moderator opening a ticket must not clear the notice
telling the player a reply is waiting.

**A GET that writes is reachable cross-site, and the cookie is `SameSite=Lax`.**
Lax withholds the cookie from a cross-site POST but *sends* it on a top-level
GET navigation, so a link on somebody else's page — `<a
href="https://zanaris.rs/api/messages/41">` — followed by a signed-in reader
marks message 41 read. Nothing is disclosed (the response goes to the reader,
not to the other site) and nothing is destroyed; what it costs is the in-game
"you have unread messages" alert for that one message. Cosmetic, and still a
write somebody else's page can cause.

So the two API GETs, `GET /api/messages/<id>` and `GET /api/tickets/<id>`,
require **`Sec-Fetch-Site: same-origin`** and answer 403 `origin` otherwise.
`Origin` is no use on a GET — browsers do not send one — but every current
browser sends `Sec-Fetch-Site`, and script cannot forge it. Only `same-origin`
passes: `cross-site` and `same-site` are the case above, and `none` (a direct
address-bar visit) is refused too, because these routes exist for `fetch` and
nothing the site does arrives that way.

The **pages** are deliberately left alone. `/messages/<id>` and
`/messages/tickets/<id>` are navigation targets — a bookmark, a link in a
notice, the back button — and gating those on `Sec-Fetch-Site` would break the
ordinary ways somebody arrives at their own message to fix a cosmetic problem.

### The staff side

`/staff` (with `?status=open|closed|all`), `/staff/tickets/<id>`,
`/staff/notice`, `/staff/reports`, `/staff/reports/<id>`, `/staff/wealth` and
`/staff/handbook` need `staffmodlevel >= 2`, and it is read from
`accounts.profile` **on every request**. The session cookie carries a
username, an issue time and a salt fingerprint and deliberately no level: a
level in a cookie is one that survives a demotion for seven days and one that
anybody who could forge a cookie could grant themselves.

That is the second of two locks. Every staff SQL function calls
`accounts.is_staff(p_actor)` itself — a `WHERE` clause in the three reads, an
early `RETURN 'forbidden'` in the two writes — so a route that forgot the page
check would still return nothing and write nothing. The page check decides what
somebody *sees*; the SQL decides what they can *do*.

A signed-in player who is not staff is **redirected to the login form**, not
shown a 403. A 403 page confirms the URL is real and that the reader simply
lacks the level, which is reconnaissance handed out for free; a redirect makes
`/staff` look the same to them as it does to a stranger.

### The one form that re-types a password

`/staff/notice` writes into somebody else's inbox with a moderator's name on
it, so it asks for the moderator's password again, through the same salt
handshake the account centre uses: `accounts.password_salt(actor)` →
`bcrypt(lower(typed), salt)` → `accounts.staff_notice` compares it against the
stored hash. A stolen session is not enough, and neither is a leaked
`DATABASE_URL`.

Its failures ride `accounts.throttled` in a bucket of their own,
`notice:<actor>`, and not the actor's login bucket: ten fat-fingered notices
must not also lock a moderator out of signing in.

### Reports

Report Abuse used to be posted to the logger thread, and the logger server is
disabled on this fleet, so every report was dropped while the player was told
it had been received. The login server writes the row now and knows both who
pressed the button and which world they were on, which is why
`report.reporter_account_id` and `report.world` are nullable and why anything
older reads as "unknown" on `/staff/reports`.

A report carries no text: the 2004 packet is an offender and a rule number.
`lib/staff/format.ts` transcribes the two engine encodings the page needs —
`ReportAbuseReason` (zero-based, onto the twelve rules `/rules` already lists)
and `CoordGrid.packCoord` — with the engine file named against each.

## Report evidence

A macro report used to be a sentence with nothing behind it. From migration 4
the world keeps a rolling ten minutes of every player's mouse in memory, and a
report for macroing or bug abuse drains that ring into `report_input` and opens
a fifteen-minute live tail; the logger server copies the offender's own chat
for the window into `report_chat`, and `session_wealth` — kept seven days for
everybody — supplies what changed hands. `/staff/reports/<id>` is where a
moderator reads all of it.

Two of those reads have a ceiling, and the page says so rather than looking
complete. `staff_report_input` returns at most 200 chunks against a count the
report row carries; `staff_report_chat` returns at most 2,000 lines and a
`total` column — a `count(*) OVER ()`, so it is on every row — against which
the page prints "showing N of M lines". Everything below a partial read,
including the verdict, is computed from what came back, and a moderator about
to ban somebody must never be shown part of the evidence as the whole of it.

### The decoder

`lib/staff/macro/decode.ts` is **the only thing anywhere that reads
`report_input.data`**. The engine passes the client's bytes through untouched
and the database stores them as `bytea`, so both encodings are decoded here:

- the engine's framing from `engine/src/engine/entity/tracking/InputRing.ts` —
  a one-byte record type then a big-endian payload, six of them: camera, applet
  focus, click, move, a per-tick **time anchor** and a **marker** saying why the
  record has a hole in it (a dropped move packet, the flood cap, the ring
  wrapping, the live tail beginning);
- the client's own from `Client.ts:2061-2189` — the click word
  `(delta50ms << 20) | (button << 19) | (y * 765 + x)`, and the 2/3/4-byte
  cursor encoding whose `delta` counts the 50 ms samples in which the cursor
  did not move.

`lib/staff/macro/input-tracking-contract.json` is a **byte-for-byte copy** of
`engine/test/fixtures/input-tracking-contract.json`: a real chunk with every
event it must decode to. `decode.test.ts` asserts the decoder reproduces it
exactly and writes the record and marker numbers out by hand, so re-copying the
fixture after a framing change fails a test rather than shipping quietly. The
same file supplies `TICK_MS`, `SAMPLE_MS` and the applet's 765×503 rather than
this side repeating them.

Times are milliseconds from the chunk's `started_at`. An anchor dates the
records after it to 600 ms; a move record's samples *end* at that instant and
run backwards at 50 ms each, so the events of one record can be dated earlier
than the record before it — they are, and sorting them by time would be the
lie. A chunk with no anchor at all (nothing the current engine writes) is
reconstructed backwards from `flushed_at` with the click chain as the clock.

Two things the decoder refuses to guess. The cursor is a relative encoding
whose state lives in the client across packets, so a capture that begins
mid-session has no position until the first absolute step: those steps decode
with `x` and `y` null and raise `unknown-cursor`. And a relative step that
lands outside the applet means the tracking is wrong rather than that the mouse
left the screen — the client clamps every sample — so the cursor goes unknown
until an absolute step re-seats it.

### The verdict

`metrics.ts` measures and `verdict.ts` judges, and they are separate files so
that moving a threshold cannot quietly change what was measured. Eleven signals
sit in three families — **timing** (click-interval spread, commonest interval,
longest unbroken rhythm, break regularity), **cursor** (repeated pixels, spread
inside the busiest square, clicks with no approach, samples per click,
stillness around a click, straight-line journeys) and **focus** (clicks while
the applet had none).

| Verdict | When |
| --- | --- |
| Likely macro | bot-like on ≥2 timing **and** ≥1 cursor signal; or any unfocused click; or ≥3 bot-like signals spanning at least two families |
| Review | one bot-like signal, or three suspicious ones |
| Human-like | everything else |
| Not enough data | nothing could be measured |

The headline is the family verdict and **never a count of signals**: half of
them are different ways of noticing one fixed click interval, and a moderator
who trusts a fraction will ban somebody for clicking a bank booth in a rhythm.
Every row of the table prints the false positive that makes it a signal rather
than a proof. Timing needs 30 click intervals and 50 for a rhythm; below that
it says so.

The two-family clause is the point of grouping at all. A fixed click interval
makes the spread zero, the commonest interval 100% *and* the unbroken run as
long as the capture, so three bot-like timing signals can be three views of one
observation — which is a Review and a second capture, not a ban. The plan's
curved-path script is exactly that stream: it defeats every cursor signal, its
clock convicts it three times over, and the page says Review.

Four deliberate brakes:

- the cursor family is **not evaluated at all** for a Java client (whose packets
  carry at most one move record) or a throttled tab (whose 50 ms sampler is not
  running), and the page says which;
- the focus family is withheld, and the verdict held at Review, for a capture
  the flood cap truncated or one whose last record ran off the end of the bytes.
  Focus is a state and the client only reports the *change*, so a capture that
  lost the "focus regained" record reads every click after it as a click into a
  window nobody was looking at — the one signal that convicts on its own;
- a **touch-like** stream — taps with nothing between them, spread around the
  screen, at a person's uneven pace — never exceeds Review, because a phone has
  no cursor to measure;
- click *intervals* come from the client's own click word, not from the event
  times: the engine can only date a click to 600 ms, and a spread computed from
  that would be a measurement of the tick.

Two of the plan's signals had to be redefined against what the client actually
does. It flushes its move packet **on the click** and writes no step for a
still cursor, so the last movement before a click is always dated at the click
and "time since the cursor last moved" is not a measurable quantity. What is
measurable is the length of the last hop into the target (a hand decelerates; a
`moveTo` does not) and the stillness *around* a click, which arrives late but
arrives whole.

`reference-encoder.ts` is imported by nothing on the site: it mirrors the
client's own loop so the tests can write a stream as positions and clicks and
read it back as events. Five of them — a player, a fixed-period script, a
script that draws curves, a phone and a background tab — go through the whole
pipeline in `verdict.test.ts` with the verdict a moderator should get.

### Resolving, and lifting

`POST /api/staff/reports/<id>/resolve` re-types the moderator's password
through the same salt handshake `/staff/notice` uses, because one of the three
resolutions is destructive: **`dismissed` deletes the evidence** for that
report's uuid, immediately and permanently.

A uuid is a *capture*, not a report. The world captures a player once per
fifteen minutes and every report filed against them inside that window points
at the same one, so six people reporting one macroer produce six report rows
and one copy of the evidence — and dismissing any of them deletes it for all
six. The form says so under the choice, because the duplicate is the report
that looks safest to clear out first and is exactly the one that takes the real
report's evidence with it.

`POST
/api/staff/punishments/<id>/lift` re-types one because it clears
`account.banned_until` or `muted_until` *and* stamps `punishment.lifted_at` in
one statement — the two drifting apart is the failure it replaces, where a
player un-banned in the database was still banned on the public page. The
punishment row is never deleted; it stays on `/bans` saying it was lifted.

The drawings on the page are **server-rendered SVG with no script**: a click
tick per click, cursor density behind them, unfocused spans shaded, the report
instant marked, and the applet's own 765×503 with the clicks plotted on it.
Evidence that needs JavaScript to appear is evidence that disappears.

`/staff/wealth?username=` is a plain GET form over
`accounts.staff_wealth`: seven days, staff only, never public.

## Public record and economy

Two pages exist because the owner decided that what happens inside the server
should be checkable from outside it: `/bans` is a permanent record of every
punishment, and `/economy` is what the game contains. Both are public, both are
inside the 2004 chrome, and both are `export const revalidate = 300` — five
minutes of ISR, so a burst of readers is one database read rather than
thousands.

All four calls live in `lib/public/queries.ts`, one line each. The functions
are `SECURITY DEFINER` reads in the engine repo's `4_evidence_and_records`
migration and the `website` role has no grant on the tables behind them:

| Function | Returns | The page |
| --- | --- | --- |
| `accounts.public_punishments(p_limit, p_offset)` | `username, kind, issued_at, until, automated, note, lifted_at` | `/bans` |
| `accounts.public_economy(p_days)` | `taken_at, players, coins, tracked` | `/economy` |
| `accounts.public_economy_flow(p_days)` | `taken_at, item_id, delta` | `/economy` |
| `accounts.public_staff_spawns(p_days)` | `created_at, item_id, count, world` | `/economy` |

### What `/bans` does not say

**Who issued it.** A row reads "A moderator" or "Automated" and there is no
column for a name, because `public_punishments` does not return one — not the
issuer's account id and not their username. That is enforced in SQL, so no
change on this side could publish it by accident.

Nothing else is held back. Expired punishments and lifted ones stay on the
record with their dates; a record that quietly loses rows is not a record, and
"Lifted 3-Sep-2026" is the row a wrongly-banned player most wants other people
to be able to see. The record begins when migration 4 lands: punishments issued
before then were never written down in a publishable form, and the page says
so.

Paging follows `/news` — `/bans`, then `/bans/page/2`, the arrows walking the
list rather than the calendar — with one difference: the pages cannot be
enumerated at build time, so there is no `generateStaticParams` and each page is
rendered on demand and then cached. The statement asks for `BANS_PAGE_SIZE + 1`
rows and `parsePunishmentPage` drops the extra, which is how the page knows
there is a next one without a second count over a table that only grows.

### What `/economy` counts

An hourly census on the hub reads every `.sav` file and sums every item id
across every permanent inventory. So:

- **A logged-in player is counted as of their last save.** Anything picked up
  since appears at the next save, not immediately.
- **Shop stock and ground items are not counted.** Neither is anything held by
  an account that never logs out again. They are not in a save file, so by this
  definition they are not "in existence".
- **"Entered" and "left the game" are the difference between one census and the
  next.** A trade moves an item between two saves and changes nothing.

The page says all three out loud, because a total without its definition is
worse than no total.

The census is four pages, not one: `/economy` is the totals and the charts,
`/economy/items` every object in the game with a search over it,
`/economy/rares` what has entered and left, and `/economy/about` how all of it
is counted and what it cannot prove. `ECONOMY_SECTIONS` in
`lib/public/sections.ts` holds them, and a test keeps their slugs disjoint from
the window slugs — `/economy/[window]` and `/economy/items` are siblings, so a
section named `24-hours` would silently shadow a tab.

The charts are inline SVG rendered on the server: a `d` attribute and no
charting dependency. `chartPath` in `lib/public/economy.ts` does the arithmetic
and `components/public/EconomyChart.tsx` only draws — the box is 300x60
stretched to the panel with `preserveAspectRatio="none"` and a
`non-scaling-stroke`, which is why the scale is printed underneath in words
rather than drawn inside a stretched viewBox. The vertical scale is the data's
own range rather than zero: an hourly coin total against a zero baseline is a
flat line whatever it did.

Each chart draws two lines over one shared range: what the census counted, and
`movingAverage`'s trailing twelve-hour trend through it, with a key naming
both. It used to draw the one series twice — a line, and the same path closed
to the baseline as a faint fill — which read as two series and invited a
question there was nothing to answer with.

`EconomyCrosshair.tsx` is the page's **one client component**, and it is a
progressive enhancement: the SVG, its `aria-label` and the printed scale are
complete without it, and the overlay renders nothing on the server so there is
nothing to mismatch on hydration. Everything it draws is HTML positioned over
the SVG rather than elements inside it, because x is stretched about threefold
at full width and y is not — a `<circle>` in there is an ellipse. The dot's
height is `chartPath`'s own `ys`, handed back down, so the browser never
recomputes a scale the server already decided.

Both charts share one crosshair through a context, which is only meaningful
because `alignedSeries` gives them one axis. `seriesOf` drops the hours *its
own* pick could not read, and coins and players are independently nullable, so
the two series could be different lengths — and since `chartPath` spaces points
by index, the same index was not necessarily the same hour in both.

`/economy/items` is the only page here that is not a cached page: reading `?q=`
is a request-time API, so the route renders per request whatever `revalidate`
says. The reads are wrapped in `unstable_cache` instead. Note that it stores
JSON, so the group ranges go in as pairs and come back out as a `Map` — handed
a `Map` directly it returns `{}`, and every category would quietly lose its low
and high line.

Search walks the **object table**, not the census. `toCounts` in the engine
fills zeros only for the tracked rares, so an object nobody owns is absent from
`economy_snapshot.items` rather than present at nought — and "Blue partyhat 0"
is the most interesting row the page can print.

Daily change compares the newest census with the newest one a full day older,
not with the row 24 back, so a missed hour cannot become a wrong figure.

### Empty is a state, not a failure

Both pages have to look finished with no rows, because that is how they look
until the migration is applied and the timer has run once — and again on any
day nothing happened. `lib/public/read-server.ts` therefore separates "the read
failed" (the page says so) from "there is nothing yet" (each block says what it
is waiting for). `/economy` degrades a block at a time: losing the flows or the
staff spawns costs those blocks, not the totals above them.

### Item names

The census counts item ids, and no page may ever print one on its own.
`lib/items/names.json` is a committed `{id: name}` table for all 3883 named
objects, and `itemName()` answers `Item <id>` for anything missing.

```sh
npm run items:update             # CONTENT_DIR=../Server/content
```

The **ids** come from `content/pack/obj.pack`, the `<id>=<debugname>` file that
is the one place the engine assigns them (`tools/pack/config/ObjConfig.ts`
walks `0 .. ObjPack.max` and looks each id up in it). Reading that rather than
unpacking `data/pack/server/obj.dat` means no engine build is needed: the
`.pack` file is the source and the `.dat` is an artefact of it.

The **names** come from the `[debugname]` blocks in the content repo's `*.obj`
configs, resolved with the packer's own rules — `name=` when there is one, the
capitalised debugname when there is a model but no name, and for a `cert_x`
note the linked object's name, because the packer synthesises those configs
with a `certlink` and the client shows the link's name.

Two departures from what the game shows, both because a public table is not a
game interface: a note is marked `(noted)`, and a name that several ids answer
to is qualified by whatever its debugname adds — `Halloween mask (green)`,
`Longbow (unstrung, noted)`. The object a name was written for keeps it plain,
so 995 is `Coins` and 617 is `Coins (fake)`. `lib/items/names.test.ts` asserts
that no two ids share a label.

Re-run the script after a content bump and commit the result.

## Hiscores

Ranking is `level DESC, value DESC, date ASC, account_id ASC`, rank from
`row_number()`. Within a skill, level only rises with XP, so the leading key
only matters for Overall, where it is total level: a higher total level ranks
above more total XP. `value` is XP times ten, so every display divides by ten
and floors. Names are stored base37-safe (`the_inducted`) and shown title-cased
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

## Invites

Registration is invite-only (engine migration `6_invites`). `/register` is a
closed door with a box for a pasted code; the form lives at `/join/<code>`,
which names the player who made the link and spends it only when the account
is created.

- Every account has `invites_enabled`, **off by default**. Staff switch it on
  at `/staff/invites` (password re-typed), including for their own account, or
  with `npm run account -- invite-enable <name>` in the engine repo. The very
  first staff account comes from the engine's `npm run account -- create-staff`;
  everything after that can be done here.
- An enabled account mints links at `/account/invites`: single-use, fourteen
  days, at most twenty unused at a time and a hundred a day.
- A ban switches inviting off and cancels the account's unused links (a
  trigger on `account.banned_until`). Lifting the ban does not switch it back.
- The citizen number is `account.id`. It is public (account centre, hiscores);
  who invited whom is shown only to the two players and to staff.
- Codes are sixteen Crockford base32 characters from ten random bytes
  (`lib/invite/code.ts`). Only the website mints them; the engine's staff
  tools can switch inviting on and off and list an account's links, but never
  create one, so the caps above always apply.

A leaked `website` credential does not get open registration back, but it is
not nothing. `invite_create` takes no password - only a username and a
pre-generated code - so it can mint links for any account that already has
inviting switched on. `register_with_invite` takes the client IP as a plain
argument rather than reading it off the connection, so a credential that can
call it at all can also lie about that IP and claim links without the signup
caps ever binding it. And `staff_invite_tree` / `staff_inviters` take the
staff actor as a name, not a session, so it can read the invite tree for
anyone already staff - the same trust every other staff read in this API
places in its caller. All of that is still far narrower than before migration
6, when the same credential could call `accounts.register` and create an
account outright.

## Records

Timed XP records (engine migration `8_records`), started and stopped here and
measured by the database from the hiscores - no engine change, no scheduler.
`/hiscores/records` is the public board, built on the hiscores' own layout
and stylesheet (`?category=N`, same numbering) and linked from every hiscores
header; `/records`, where it launched, redirects there with its query.
`/account/records` is where a signed-in player starts, watches and stops one.

- **The flow.** Log out of the game, press Start record, log in and play, log
  out before the timer reaches 0:00, press Stop record. Both snapshots are
  read from `hiscore` / `hiscore_large` *while the player is logged out*, so
  neither can be stale; the gain is end minus start, per skill and Overall.
- **The window** is Start to the **final logout** - `account_login.logout_time`
  as Stop finds it - not to the Stop click. Over the duration plus its grace
  (five minutes plus ten seconds today) is rejected as over time, and every
  result shows the actual time it took. The grace is there to absorb the
  world acting on the logout, the login server writing it down and combat's
  logout lock, not to be aimed for, so the page's steps say 0:00 and never
  mention it. Nobody
  is logged out for them: logging out in time, and pressing Stop before
  logging in again, is the player's job, and the page says so before they
  start.
- **The five-second wait.** Start and Stop both refuse ("syncing") until five
  seconds after a logout, because the login server writes `logged_in = 0`
  before it runs `updateHiscores`; a snapshot inside that gap would read the
  hiscore from before the session just ended. The page retries by itself.
- **Void is ours.** A session that began after the last clean logout and ended
  some other way (a crash, a forced logout) makes the attempt void, which
  costs the player nothing against their twelve starts an hour.
- **Only valid attempts are public.** Rejected, void and abandoned attempts
  stay on the player's own history with the reason; `accounts.record_board`
  alone decides what the board shows, and applies the hiscore views' staff and
  ban rule itself. Staff above level 1 and banned accounts cannot start.
- **The timer** is derived from the stored `started_at` and the database's
  clock (`server_now` on every read), so a refresh, a second tab or a phone all
  agree, whatever the device's clock says. The account page polls
  `GET /api/records/current` every five seconds while the tab is visible and
  not at all while it is hidden. Once the player has logged out it freezes on
  the logout and says whether it made the window.
- **No cron.** An attempt nobody stopped reads as abandoned an hour after its
  window, and is stored that way by the player's next Start, Stop or Cancel.

What each piece says to the player lives in `lib/records/verdict.ts`, with a
test that every code the SQL can answer has a sentence. The durations the site
offers (`lib/records/durations.ts`) must match `accounts.record_durations()`;
`npm run db:check` asserts it.

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

### `POST /api/account/login`

```json
{ "username": "Bob Smith", "password": "hunter22", "turnstileToken": "..." }
```

200 `{ "ok": true, "username": "bob_smith" }` and a `Set-Cookie` for
`zanaris_session`. Otherwise:

| Status | `error` | When |
| --- | --- | --- |
| 400 | `bad_request` | the body is not JSON |
| 400 | `turnstile` | the anti-bot check did not pass, or carried the wrong action |
| 400 | `username_format`, `username_unencodable` | the name cannot be a name |
| 401 | `bad_credentials` | wrong name **or** wrong password — one answer for both |
| 403 | `origin` | the `Origin` header is missing, `null`, or another site |
| 429 | `rate_limited` | 10 failures for the name, or 20 for the IP, in 15 minutes |
| 503 | `unavailable` | `SESSION_SECRET` or `DATABASE_URL` unset, or the call failed |

### `POST /api/account/logout`

No body. 200 `{ "ok": true }` with the cookie cleared, or 403 `origin`. It
succeeds whether or not there was a cookie.

### `POST /api/account/password`

```json
{ "currentPassword": "hunter22", "newPassword": "hunter33" }
```

200 `{ "ok": true }`, and a fresh `zanaris_session` for the caller — every
other device is signed out. Otherwise 401 `session_expired`, 403 `origin`, 403
`bad_credentials`, 400 `password_short` / `password_long` /
`password_charset` / `password_same`, 429 `rate_limited`, 503 `unavailable`.

### `POST /api/account/email`

```json
{ "currentPassword": "hunter22", "email": "bob@example.com" }
```

200 `{ "ok": true, "email": "bob@example.com" }` — the stored, lower-cased
form. Otherwise 401 `session_expired`, 403 `origin`, 403 `bad_credentials`,
400 `email_format` / `email_disposable` / `email_no_mx`, 429 `rate_limited`,
503 `unavailable`. The session is **not** re-minted: the salt has not moved.

### `POST /api/account/invites`

No body. 200 `{ "ok": true, "code": "4NDPK5XG7HRV0S28", "expiresAt": "..." }` —
the raw, ungrouped code and an ISO timestamp; `/join/<code>` and the
account's own invite list are what dash the code for display. Otherwise 401
`session_expired`, 403 `origin`, 403 `disabled` (inviting is off for this
account, or it is banned), 429 `too_many` (twenty live links or a hundred
minted today), 503 `unavailable`. A code collision on the unique index
retries once inside the route and is never answered to the caller.

### `POST /api/account/invites/[code]/revoke`

No body. 200 `{ "ok": true }`. Otherwise 401 `session_expired`, 403 `origin`,
404 `not_found` (somebody else's code, a dead link, one that never existed, or
a string that cannot be a code), 409 `already_claimed`, 503 `unavailable`.

### The record routes

All four need the signed-in session; the three POSTs also need a same-origin
`Origin`. Every error is `{ "error": "<code>" }` with `no-store`, and 401
`session_expired`, 403 `origin` and 503 `unavailable` can come from any of
them.

- `POST /api/records/start` - body `{ "duration": 300 }` or none. 200
  `{ "ok": true }`. 400 `unknown_duration`; 403 `staff` / `banned`; 409
  `logged_in` (still in the game), `syncing` (logged out less than five seconds
  ago), `already_running`, `no_hiscore` (no clean logout or no hiscore row
  yet); 429 `too_many` (twelve starts in the last hour).
- `POST /api/records/stop` - no body. 200
  `{ "ok": true, "state": "valid" | "rejected" | "void" | "abandoned", "reason": ... }`.
  409 `logged_in`, `syncing`, `not_running`.
- `POST /api/records/abandon` - no body. 200 `{ "ok": true }`. 409
  `not_running`.
- `GET /api/records/current` - `{ presence, logoutTime, serverNow, attempt }`,
  `attempt` null or the newest attempt with raw (x10) `gainedValue`; see
  `RecordCurrentRow` in `lib/records/queries.ts`.

### `GET /api/records/board`

`?category=N` (hiscore numbering, default 0) and `?duration=S` (default 300).
200 `{ durationSeconds, category, rows: [{ rank, username, name, xp,
elapsedMs, achievedAt }] }`, `xp` as players see it, each player's best
valid attempt, best first. 400 `bad_category` / `bad_duration`, 503
`unavailable`. Cached `public, s-maxage=60, stale-while-revalidate=600`, as
the hiscores are.

### The Message Centre routes

Every route in this section and the staff one below is Node-runtime,
`Cache-Control: no-store`, and answers 401 `session_expired` without a valid
`zanaris_session` — where *valid* means the account still exists and its salt
fingerprint still matches, re-read from `accounts.profile` on the request
(`requireLiveSession`), so a password change signs these routes out too. The four `POST`s — `/api/tickets`,
`/api/tickets/<id>/reply`, `/api/staff/tickets/<id>/reply` and
`/api/staff/notice` — check `Origin` and answer 403 `origin`. Field errors —
`subject_empty`, `subject_long`, `subject_charset`, `body_empty`, `body_long`,
`body_charset` — are 400s, and each has a sentence of its own in
`lib/messages/format.ts`.

| Route | Body | Success |
| --- | --- | --- |
| `GET /api/messages` | | `{ unread, messages: [...] }`, unread first |
| `GET /api/messages/<id>` | | `{ message }` **and marks it read** |
| `GET /api/tickets` | | `{ tickets: [...] }` |
| `POST /api/tickets` | `{ kind, subject, body }` | `{ ok: true }` |
| `GET /api/tickets/<id>` | | `{ ticket }` **and marks its replies read** |
| `POST /api/tickets/<id>/reply` | `{ body }` | `{ ok: true }` |

`kind` is `bug`, `appeal` or `other`; anything else is 400 `kind_invalid`.
Beyond the field errors: 404 `not_found` for a message or ticket that is not
this account's (indistinguishable from one that does not exist, on purpose),
409 `closed` for a reply to a closed ticket, 429 `rate_limited` for the sixth
ticket in a day or the twenty-first reply in an hour, 503 `unavailable`.

The two **GETs that mark something read** add 403 `origin` of their own, on
`Sec-Fetch-Site` rather than on `Origin` — see "Two GETs that write" above.

### The staff routes

The same, plus `staffmodlevel >= 2` read from `accounts.profile` on the
request; a signed-in account without it gets 403 `forbidden`.

| Route | Body | Success |
| --- | --- | --- |
| `GET /api/staff/inbox?status=open\|closed\|all` | | `{ status, tickets: [...] }` |
| `GET /api/staff/tickets/<id>` | | `{ ticket }`, marks nothing read |
| `POST /api/staff/tickets/<id>/reply` | `{ body, close? }` | `{ ok: true, closed }` |
| `POST /api/staff/notice` | `{ username, subject, body, password }` | `{ ok: true, username }` |
| `GET /api/staff/reports?since=<ISO>` | | `{ reports: [...] }` |
| `POST /api/staff/reports/<id>/resolve` | `{ resolution, note?, password }` | `{ ok: true, resolution }` |
| `POST /api/staff/punishments/<id>/lift` | `{ note?, password }` | `{ ok: true }` |
| `POST /api/staff/invites/<username>` | `{ enabled, password }` | `{ ok: true }` |

`status` and `since` are parsed, not passed through: an unrecognised status
would match no row and read as a quiet day, and an unparseable `since` shows
the function's default week rather than a 400.

A staff reply is one call and two rows — the thread message, and the
`account_message` of kind `reply` that raises the player's unread count — plus
a `staff_action` audit row. `close` is the only way to write on an
already-closed ticket. `POST /api/staff/notice` adds 403 `bad_credentials` for
a wrong re-typed password (403, not 401: the caller *is* signed in), 404
`not_found` for a recipient nobody is, and 429 `rate_limited`.

The two `POST`s at the bottom of the table check `Origin`, answer 403
`bad_credentials` on a wrong re-typed password like `/api/staff/notice` does,
and 404 `not_found` for an id that is nobody's report or nobody's punishment.
`resolution` is `actioned`, `dismissed` or `watch`; anything else is 400
`invalid`. The note is optional on both and validated like a message body
(`body_empty`, `body_charset`), with 400 `body_long` past `STAFF_NOTE_MAX` on a
resolve and 400 `note_long` past `PUBLIC_NOTE_MAX` on a lift — the resolve note
is staff-only, the lift note goes on the public record. **`dismissed` deletes
the evidence** for that report's uuid, and a uuid is a capture rather than a
report, so it deletes it for every report filed inside the same window; see
"Resolving, and lifting" above.

## Deployment

Vercel, project `Zanaris-rs/Website`, functions pinned to `iad1` by
`vercel.json` so they run next to Supabase in us-east-1. Pushing to `main`
deploys; a pull request gets a preview deployment.

The worlds themselves are not here — they stay on the hub under
`*.04.zanaris.rs`, deployed by `Server/ec2-setup`.

**`www.zanaris.rs` 308s to the apex** (`redirects()` in `next.config.ts`,
matched on the `host` header). Both hostnames served the site directly, which
gives every page two URLs — a nuisance for canonical links, and a real problem
for the host-only session cookie: a login on the apex would be invisible on
`www`, and a single link would silently sign the reader out.

**`SESSION_SECRET` has to be set on Vercel, separately for Production and
Preview**, and to *different* values: a preview deployment is not a place to
mint production sessions. Generate each with `openssl rand -hex 32`. Until it
is set, the deployment's login route answers 503 and its account pages
redirect — the correct resting state, and the same shape of "looks fine, refuses
everything" as an unset `TURNSTILE_SECRET_KEY`. If previews have to be able to
log in, add `*.vercel.app` to `ALLOWED_TURNSTILE_HOSTNAMES` there as well.

Almost everything is prerendered at build time. `/title` is the exception: it
renders per request (`export const revalidate = 0`), because it reads the
session cookie to decide whether to show the Staff Inbox tile. The world polls
behind the live player count are cached for fifteen seconds per fetch, so
however many people load the page, the worlds are asked once in that window.
`public/worlds.json` is read at build time, so a world added by the
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
| `app/hiscores/records/page.tsx` | the record board; `/records` redirects here |
| `app/register/page.tsx` | the closed door: paste an invite code, continue to `/join/<code>` |
| `app/join/page.tsx` | the pasted-code box; redirects a valid code to `/join/<code>` |
| `app/join/[code]/page.tsx` | the invite preview, and the registration form for a live one |
| `app/account/login/page.tsx` | the login box |
| `app/account/page.tsx` | the account centre |
| `app/account/password/page.tsx`, `app/account/email/page.tsx` | the two change forms |
| `app/account/invites/page.tsx` | the account's own invite links: mint and revoke |
| `app/staff/invites/page.tsx` | who may invite, and who let whom in |
| `app/messages/page.tsx` | the Message Centre: messages and tickets, unread first |
| `app/messages/[id]/page.tsx` | one message — rendering it marks it read |
| `app/messages/new/page.tsx` | the ticket form, with the bug-report hint |
| `app/messages/tickets/[id]/page.tsx` | the player's own thread, with a reply box |
| `app/staff/page.tsx` | the staff inbox, `?status=open\|closed\|all` |
| `app/staff/tickets/[id]/page.tsx` | a ticket as staff see it; marks nothing read |
| `app/staff/notice/page.tsx` | write a notice, re-typing the staff password |
| `app/staff/reports/page.tsx` | Report Abuse rows, `?since=<ISO>` |
| `app/staff/handbook/page.tsx` | the moderation handbook, from `content/staff` |
| `app/bans/page.tsx`, `app/bans/page/[n]/page.tsx` | the public ban record, ISR at 5m |
| `app/economy/page.tsx` | the census overview: totals and charts, ISR at 5m |
| `app/economy/items/page.tsx` | every object in the game, and the search over it (dynamic; reads cached) |
| `app/economy/rares/page.tsx` | what has entered and left the game, ISR at 5m |
| `app/economy/about/page.tsx` | how the count works, and what it cannot prove |
| `app/api/hiscores/route.ts` | the table API |
| `app/api/hiscores/player/[username]/route.ts` | the personal API |
| `app/api/account/register/route.ts` | registration through an invite, Node runtime, `no-store` |
| `app/api/account/login/route.ts`, `logout`, `password`, `email` | the salt handshake, the cookie, and the two compare-and-set changes |
| `app/api/account/invites/route.ts` | `POST /api/account/invites` — mint one invite link for the signed-in account |
| `app/api/account/invites/[code]/revoke/route.ts` | `POST /api/account/invites/[code]/revoke` — cancel one of its own unused links |
| `app/api/messages/**`, `app/api/tickets/**` | the player's six calls; two of the GETs mark rows read |
| `app/api/staff/**` | the inbox, one thread, a reply that can close, a notice, the reports, switching a citizen's inviting on or off |
| `components/site/Frame.tsx` | the 2004 page chrome every page is inside |
| `components/site/Tile.tsx` | the one component allowed a bare `<img>` |
| `components/site/` | `TitleBox`, `Panel`, `StonePanel`, `StoneCaption`, `StoneButton`, `MenuTile`, `PageNav`, `Disclaimer` |
| `components/news/`, `components/rules/`, `components/worldmap/` | the list and post views, the rule card, the map canvas |
| `components/hiscores/` | the table, the personal page, the shared header |
| `components/account/RegisterForm.tsx` | the form, the Turnstile widget, the warnings |
| `components/account/` | `LoginForm`, `AccountCentre`, `LogoutButton`, `ChangePasswordForm`, `ChangeEmailForm` |
| `components/messages/` | the inbox, one message, a thread, the reply box, the ticket form |
| `components/staff/` | the inbox table, the staff thread and reply box, the notice form, the reports table, the report page, the handbook |
| `components/public/` | the ban record, the four census pages and their server-rendered SVG charts |
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
| `lib/account/salt.ts`, `session.ts` | the salt handshake and the signed cookie — both pure, both tested |
| `lib/account/session-server.ts`, `profile-server.ts` | the halves that need a request: read/require/set/clear, and "is this cookie still good" |
| `lib/account/origin.ts`, `login.ts`, `profile.ts` | the CSRF check, the four SQL calls, the account-centre wording |
| `lib/account/message-centre-contract.json` | the cross-repo Message Centre contract, copied from the engine |
| `lib/messages/` | the seven player SQL calls and their parsers; the kinds, caps and wording |
| `lib/staff/` | the staff SQL calls, the staff level, the shared staff nav, the handbook parser and reader, and the engine encodings `/staff/reports` decodes |
| `lib/public/` | the four public SQL calls and their parsers, the census maths, the wording, and the server-side reads |
| `lib/items/names.json`, `names.ts` | item ids as names, generated from the content repo |
| `content/news/` | the news posts, read at build time |
| `content/staff/` | the handbook's ten sections, read on a request |
| `scripts/db-check.mts` | `npm run db:check` |
| `scripts/vendor-2004-assets.sh` | `npm run assets:vendor` |
| `scripts/update-worldmap.sh` | `npm run worldmap:update` |
| `scripts/update-item-names.sh` | `npm run items:update` |
| `public/img/` | the 2004 page graphics |
| `public/js/mapview.js`, `public/worldmap.jag` | the map applet and its data |
| `types/mapview.d.ts` | the one type the map applet needs, since it is loaded by URL |

Everything under `lib/` is pure and unit-tested (`lib/**/*.test.ts`); the route
handlers and components hold no logic worth testing on their own. Two fixture
files are cross-repo contracts rather than restatements of the code:
`lib/base37-fixture.json` was generated by running the engine's `JString.ts`,
and `lib/account/bcrypt-fixture.json` holds a hash from each repo. A third,
`lib/account/message-centre-contract.json`, is a byte-for-byte copy of the
engine's own fixture and is spelled out by hand in `lib/account/contract.test.ts`.

Styling is plain CSS: `app/globals.css` (black, white 13px Arial, and nothing
else) and CSS modules alongside each component. There is no design system and
no colour variables — the palette is the 2004 one, written where it is used:
`components/site/Frame.module.css` holds the panel, the stone bezels and the
original's nine link colours, and `Site.module.css` holds the furniture built
from them. No webfonts, no CDNs, no analytics.

Containers stacked down a page are spaced by two tokens in `app/globals.css`:
`--stack-gap` (10px) from one panel to the next, and `--stack-gap-title`
(6px) from the title box, or the page nav holding it, to the first panel.
`Site.module.css` applies them with sibling rules, so a page built as
`<TitleBox/><Panel/><Panel/>` is spaced without a wrapper or a prop; the title
screen's stone frames and the rule cards use the same gap. Don't add a
margin between two panels by hand.

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
Every news URL is prerendered at build time, so **nothing reads `content/news`
on a request** — which also means a new post needs a deploy, and a malformed
one fails the build rather than rendering an empty page. (`content/staff` is
the other half of `content/`, and it *is* read on a request; see below.)
`npm test` checks every committed post the same way the build does, in a second
rather than a minute.

**Markdown is rendered without sanitisation, deliberately.** Raw HTML in a post
is a feature — a table, a coloured span, an image at an exact size — and posts
are repo files reviewed like any other change. `lib/news/render.test.ts`
asserts that raw HTML passes through, so the decision cannot be reversed by
accident. The same waiver covers the whole of `content/`: the staff handbook is
rendered unsanitised too, and `lib/staff/handbook-content.test.ts` pins it from
the other side by refusing a `<script` in a committed section. If either ever
becomes something a logged-in user can submit, those tests are the first thing
that has to change.

## Staff handbook authoring

`/staff/handbook` is the moderators' copy of the two ops guides in the server
repo, kept in step with the code it describes. A section is one Markdown file
in `content/staff`, named `NN-lower-case-slug.md`, with exactly **one**
frontmatter key:

```markdown
---
title: Bans and mutes
---

<!-- Sources: engine ClientCheatHandler.ts, ... -->

### A heading inside the section
```

- `NN` is two digits and is the reading order; the slug is the section's anchor
  (`/staff/handbook#bans-and-mutes`). Duplicate orders and duplicate slugs both
  throw.
- **Bodies use `###` and below.** The `<h2>` is the section's own title, from
  the frontmatter, so a body reaching for one is claiming to be a second
  section. A test refuses `#` and `##`.
- Every heading gets an `id` prefixed with the section's slug, so two sections
  may both have a "What the player sees". The ids are checked for collisions
  across the whole book.
- **Open with an HTML comment naming the engine or website file every number in
  the section came from.** The handbook restates constants that live in another
  repo and there is no contract file for them; the comment is what the next
  person checking them follows.
- `npm test` validates every committed section — it parses, it renders, it has
  no `<script`, no address and none of the operator's material in it. That
  matters more here than for news: the handbook is read **on a request**, so a
  malformed section does not fail the deploy, it fails the page for a moderator
  at the moment they reached for it. The page catches the throw and shows the
  "unavailable" panel; the test is what stops it shipping.

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
`lib/site.ts` when the fleet moves. `scripts/lib/client-ts.sh` holds that
step, shared with `icons:update`: if the clone already there points at another
remote — a `CLIENT_REMOTE` override outlives the run that set it — or cannot
be fetched, it says so in one line and re-clones rather than failing in the
middle of a build.

**`worldmap.jag` goes stale.** It is a snapshot of the content maps at the
moment it was packed, so a content change that moves anything on the map will
not show here until someone re-runs the script and commits the result.

## Game icons

The pictures beside item and skill names (`/economy`, `/hiscores`) are the
game's own, all committed:

| File | What |
| --- | --- |
| `public/img/game/items/<id>.png` | 32x32 inventory icon per object id, drop shadow and all |
| `public/img/game/skills/<stat>.png` | 25x25 stats-tab icon per engine stat id |
| `public/img/game/tiles/<name>.png` | 77x120 menu tile drawn from one object's model |
| `lib/items/icons.json` | the pack's object count, and the ids the client draws as nothing |
| `lib/title/tiles.json` | the tiles' version and the names the generator drew |

```sh
npm run icons:update             # ENGINE_DIR=../Server/engine, CLIENT_BRANCH=274
```

Skill icons are sprites stored in the cache. Item icons are not: the 2004
client draws each one from its 3D model at runtime, so the script runs the
client's own renderer (`ObjType.getSprite`, from the same Client-TS clone as
the map applet) under `bun`, fed from the engine's pack. The header of
`scripts/update-game-icons.sh` has the details. Two skill icons, Agility and
Thieving, are recoloured the way the 2004 site's hiscores recoloured them,
because their black silhouettes vanish on black panels.

The two menu tiles are drawn the same way, for the same reason. `/title` gives
every tile a picture and 2004 drew none for a wiki or for a desktop client, so
`render.ts` poses those objects' own models instead — the sextant for LostHQ,
the Dramen staff for Zanaris Kit — at four times tile size, averaged down,
which is where their smooth edges come from beside the 2004 photographs. Its
`TILES` table is where the object, the angle and the framing live.

Pages use `<ItemIcon id>` / `<SkillIcon stat>` (`components/game/`) or
`itemIconSrc` / `skillIconSrc` / `titleTileSrc` (`lib/items/icons.ts`,
`lib/skills/icons.ts`, `lib/title/tiles.ts`), never a hand-built path. `.claude/skills/game-icons/SKILL.md` is the short
version for agents.

**Icons go stale like the map.** Repack the engine after a content bump, then
re-run `items:update` and `icons:update` and commit what they write. The
script only packs when the pack is missing, so check the date on its `pack`
line.

`next.config.ts` caches `/img/game/*` for a year as `immutable`, because the
helpers put the generated set's version in the URL —
`/img/game/items/995.png?v=f205cfb4`. A page can carry over a hundred icons,
and a static file's default is a re-check per file per page view, so the year
is worth having; the version is what keeps it honest, since the filenames are
object ids rather than content hashes and nothing can purge a browser cache.
The version is a hash of the set's bytes, written into `lib/items/icons.json`,
`lib/skills/icons.json` and `lib/title/tiles.json` by the generator. The three
sets are hashed apart, so a run that only moves an item model leaves the skill
icons and the menu tiles cached.

A regeneration therefore reaches readers immediately, at the cost of their
re-downloading the icons on the pages they open — about 90 KB for `/economy`.
This is also why a hand-written path is a bug rather than a shortcut: with no
`?v=` it is cached for a year and never corrected.

## Chatheads

A chathead is a player's head as a quest dialogue shows it. It is not a
picture anywhere in the cache: in a dialogue the server only says "the
player's head goes here", and the client builds the model from the player's
hair, jaw and hat and draws it in software. The site does the same, in the
browser, with the client's own code:

| File | What |
| --- | --- |
| `public/game/chathead/renderer.js` | the client's `Model`, `Pix3D` and `Pix2D`, bundled (about 16 KB gzipped) |
| `public/game/chathead/models.bin` | the head models of every kit and hat, out of the 38 MB cache |
| `lib/chathead/heads.json` | kits, hats, which worn objects hide the hair or jaw, the colour palettes, the frame |
| `lib/chathead/golden.json` | reference pictures drawn by the client's own `ClientPlayer.getHeadModel` |

```sh
npm run chathead:update          # ENGINE_DIR=../Server/engine, CLIENT_BRANCH=274
```

Pages use `<Chathead look>` (`components/game/Chathead.tsx`) with a `Look`
(`lib/chathead/look.ts`) — the save file's gender, seven kits, five colours
and worn items. The renderer and the models are fetched once per page, when
the first chathead mounts, with the build's version in the URL; `next.config.ts`
caches `/game/chathead/*` for a year on the same terms as the icons.

The worn objects that empty a slot (a full helm's hair and jaw) are read
from the engine's *server* `obj.dat`, because the client never receives them.
The frame fits every hair and beard whole, and nine hats in ten; the tallest
(the snelms' points, the Warrior helm's horns) are cut off at its edge.

`golden.test.ts` draws every golden look — every kit with a head, every hat on
both genders, every colour of every part — with the committed renderer, models
and tables, and checks each against the client's own picture pixel for pixel.
`/dev/chathead` (development only) shows them all on a page.

### The outfit editor

`components/outfits/OutfitEditor.tsx` is fashionscape: up to ten outfits,
one of them the player's picture, each a `Look` whose chathead is drawn live
as it changes. Anyone may wear anything, but only in a slot it is worn in, and
only with a body the game's design screen allows — `lib/chathead/validate.ts`
holds both rules and runs on each side. The same build writes what it draws
with:

| File | What |
| --- | --- |
| `public/img/game/worn/tab.png` | the Worn Equipment tab, empty, drawn by the client from `wornitems.if` |
| `public/img/game/worn/slot-<n>.png` | each slot's silhouette, for when nothing is worn there |
| `lib/chathead/wearables.json` | every wearable object by slot, and the design screen's colour swatches |

The editor talks to an `OutfitStore` (`lib/chathead/outfit-store.ts`). On the
site that is `/account/adventurer-log/outfits` over the `/api/outfits` routes
and engine migration 12's functions (`lib/outfits/queries.ts`): `outfits`,
`outfit_save`, `outfit_delete`, `outfit_set_default`, `outfit_import_look`
(the look of the player's last save, which the login server keeps in
`account_look` since migration 11) and `outfit_default_looks`, the default
look behind a name, for a chathead (a name with no default falls back to its
look from the game; see "Adventurer Log"). Every write answers
with the outfits as they now are. `/dev/outfits` (development only) runs the
same editor over memory.

**Chatheads go stale like the icons.** Repack the engine after a content bump,
re-run `chathead:update`, and commit what it writes.

## Adventurer Log

`/adventurer-log/<name>` is a player's public page (engine migrations 11-13):
their chathead, headline, skills and about on one side, and on the other a
timeline of their adventures - levels, milestones, quests, rare drops, clue
scrolls, as the game records them - mixed with the updates they post.

- Everyone else sees an adventure **twenty minutes** after it happened, so a
  log cannot be used to follow someone around the game; the owner sees theirs
  at once. That rule, and every other one - who may write, blocks, the rates -
  is in the database's functions (`lib/adventurer-log/queries.ts`).
- The timeline is `accounts.adventure_timeline`, a `(at, rank, id)` cursor
  newest first; `lib/adventurer-log/view.ts` turns a page into plain data (post
  text cut into tokens by `body.ts`, adventure icons from `events.ts`, the
  chathead looks of everyone on the page) so the first render and every
  "Older adventures" (`GET /api/adventurer-log/<name>/timeline`) are the same
  shape, and the item tables stay on the server.
- **Chatheads.** A name's picture - in the header, beside the owner's updates
  and beside every reply - is their default outfit, and until they choose one
  their look at their last save in the game (`lib/outfits/looks.ts`:
  `outfit_import_look` for every name on the page in one statement). Before
  that look leaves the server, `headOnly` takes off everything but what the
  chathead draws (the hat): the picture is the same, and a log does not
  publish the rest of what the player had on. A player the game has not saved since migration 11 has an empty
  frame.
- **Wardrobe.** Every outfit the owner has saved is on their log for anyone
  to see, with a star on the one that is their picture
  (`components/adventurer-log/Wardrobe.tsx`, read through
  `accounts.outfits`). Only saved outfits: the look from the game that the
  header falls back to is never in it. Its classes (`.al-wardrobe`,
  `.al-outfits`, `.al-outfit`, `.al-outfit--default`, `.al-outfit-name`) are
  part of the styling contract.
- Times are fixed UTC text (`formatWhen`), not "5 minutes ago": a relative time
  would differ between the server's render and the browser's hydration.
- Every element inside `.al-root` carries a stable `al-` class. Those names are
  the log's styling contract, so `Log.module.css` styles them through
  `:global()` rather than with hashed module classes.
- `/account/adventurer-log` is the owner's side, in three boxes:
  - **About you:** headline, about, and which kinds of adventure the log
    shows (hidden for everyone, the owner included). One Save sends all three
    (`POST /api/adventurer-log/about`) as one statement, so they succeed or
    fail together.
  - **Your adventurer log's style:** the owner's CSS (below).
  - **Blocked players:** unblock, or block someone by name.

  It, `/account/adventurer-log/outfits` and the log itself link to each other
  from their title boxes (`OwnerNav`). The Account Centre reaches them from
  its "Your Adventurer" panel, beside "Account services".
- **Posting.** The owner posts updates; anyone signed in who is not muted,
  banned or blocked replies. Posts are plain text plus `[item:<debugname>]` and
  `[skill:<name>]`, which the composer's picker inserts
  (`GET /api/adventurer-log/assets?q=`, so the item tables stay on the
  server). The owner deletes any reply on their log and blocks repliers (their
  replies there stop showing); authors delete their own. Every write is a
  route under `/api/adventurer-log/` with `requireLiveSession` and the
  same-origin check, and every rule - rates, mutes, blocks - is the database's.
- **Owner CSS.** The owner writes a stylesheet on `/account/adventurer-log`
  (with a 2004 skin to start from). The database keeps it as written;
  `lib/adventurer-log/css.ts` sanitises it **every time a log is drawn**, so a
  stricter sanitiser applies to every log at once. It parses with `css-tree`
  and prints its own output: every selector prefixed with `.al-root`, `url()`
  only for the site's `/img/`, no `@import`/`@font-face`/`image-set()`/
  `attr()`, `content` with symbols but not words, no `!important`, no
  backslashes or `<`, animations no faster than 0.2s and none for
  reduced-motion readers. `.al-root` has `contain: paint` (with `!important`),
  so nothing inside - `position: fixed` included - is drawn outside the log.
  The log route sends `Content-Security-Policy: img-src 'self'; font-src
  'self'; style-src 'self' 'unsafe-inline'` as a backstop. There is no
  reader's switch to leave the owner's style out - it is their page - but
  staff can turn a log's stylesheet off from a report.
- **Reports.** "Report" on an update or reply, and "Report this log" in the
  bar above it (outside `.al-root`, so an owner's CSS cannot hide it). Staff
  read them at `/staff/adventure-reports` and resolve with a typed password,
  as for game reports: hide, turn off a log's stylesheet, or dismiss.

## 2004 assets

`public/img/` is the original 2004 site graphics — the page chrome, the stone
frame, the menu tiles, the twelve rule illustrations — apart from
`public/img/game/`, which is drawn from the cache (see "Game icons").

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

The wordmark is ours and is not a picture at all: `components/site/Wordmark.tsx`
sets the site's name in Cinzel Decorative, self-hosted at build time by
`next/font/google` (no request goes to Google from a visitor's browser), and
`Wordmark.module.css` engraves it — a dark, thick-stroked copy offset beneath a
silver gradient face. Being live text, it scales with the screen and reads as
the page's heading. `app/icon.svg` is the matching one-letter favicon.

`public/img/` is the original 2004 site graphics as served by
[Lost City](https://2004.lostcity.rs/), a preservation project.
`lib/account/disposable-domains.json` is the
[disposable-email-domains](https://github.com/disposable-email-domains/disposable-email-domains)
blocklist, released under CC0-1.0. The server this site fronts is
[Lost City](https://github.com/LostCityRS)'s, MIT-licensed; our fork is at
[github.com/Zanaris-rs](https://github.com/Zanaris-rs).
