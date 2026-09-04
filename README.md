# Zanaris — world-select website

The front door for **Zanaris**, a [Lost City](https://lostcity.rs)
(2004scape) private server. It is a two-screen static site:

- `/` and `/title` — the title screen: what the server is, and a **Play now**
  button.
- `/serverlist` — the world list: one row per world with its region, whether it
  is members or free, a live player count, and links into the game client at
  high or low detail.

Built with Next.js (App Router, TypeScript) and exported to plain HTML/CSS/JS.
There is **no Node process at runtime** — Caddy serves the exported files.

## Running it

```sh
npm install
npm run dev     # http://localhost:3000
npm test        # vitest, unit tests for lib/worlds.ts
npm run lint    # eslint
npm run build   # static export into out/
```

`npm run build` writes `out/index.html`, `out/title.html`,
`out/serverlist.html`, `out/worlds.json` and the hashed assets under
`out/_next/`.

## How it is deployed

`out/` is copied to the hub, which serves it at
`https://04.retired.invalid` via Caddy. Nothing in this repo runs on the
server.

The world list is **not** baked into the build. The deploy script writes
`worlds.json` at the site root, and the browser fetches it at page load, so
adding or removing a world does not need a site rebuild.

`public/worlds.json` in this repo is only a sample so `npm run dev` has
something to show; the deploy overwrites it.

## JSON contracts

### `worlds.json` (site root, written by the deploy script)

```json
[
  {
    "id": 1,
    "name": "World 1",
    "region": "US-East",
    "members": true,
    "url": "https://w1.04.retired.invalid"
  }
]
```

`url` is the world's origin with no trailing slash. The site derives the client
links from it: `<url>/rs2.cgi` for high detail and `<url>/rs2.cgi?lowmem=1` for
low detail.

If `worlds.json` is missing or malformed, `/serverlist` shows
"World list unavailable" instead of the table.

### `world.json` (served by each game world)

Each world serves a public JSON route at `<url>/world.json` with
`Access-Control-Allow-Origin: *` so this site can read it cross-origin:

```json
{ "id": 1, "members": true, "players": 3, "maxPlayers": 150 }
```

The world list requests it once per world on load and again every 30 seconds.
Each request gives up after 5 seconds. The players cell shows `...` while the
request is in flight, `3 / 150` on success, and `offline` on any failure —
timeout, network error, non-2xx, or a malformed body.

## Layout

| Path                        | What it is                                      |
| --------------------------- | ----------------------------------------------- |
| `app/layout.tsx`            | html/body shell, page metadata, global CSS      |
| `app/page.tsx`              | `/` — renders the title screen                  |
| `app/title/page.tsx`        | `/title` — renders the title screen             |
| `app/serverlist/page.tsx`   | `/serverlist` — heading, world table, back link |
| `components/TitlePage.tsx`  | the title screen                                |
| `components/WorldTable.tsx` | client component: fetching, polling, the table  |
| `lib/worlds.ts`             | pure logic — parsing, labels, URL building      |
| `lib/worlds.test.ts`        | unit tests for the above                        |
| `public/worlds.json`        | sample world list for local development         |

Styling is plain CSS: `app/globals.css` for the palette and CSS modules
alongside each component. No webfonts, no CDNs, no analytics.
