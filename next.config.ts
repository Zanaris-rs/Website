import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The site runs on Vercel as a Node app: hiscores and registration are
  // server-side route handlers, so there is no static export any more.
  trailingSlash: false,
  images: { unoptimized: true },

  // A log's link preview draws the chathead on the server
  // (`lib/chathead/server.ts`) with the renderer and models the browser
  // fetches from `public/`. `public/` is served by the CDN rather than
  // shipped with the functions, and the renderer is imported past the
  // bundler on purpose (`turbopackIgnore`), so the function only gets the two
  // files if the build's trace spots their paths. Turbopack does today; this
  // says so outright, so the preview does not depend on it.
  //
  // The key matches the image route (`/adventurer/[username]/opengraph-
  // image`). The page's own trace picks the files up too, because the page
  // imports the image module for its `og:image` size and alt.
  outputFileTracingIncludes: {
    "/adventurer/*/opengraph-image*": [
      "./public/game/chathead/renderer.js",
      "./public/game/chathead/models.bin",
    ],
  },

  async redirects() {
    return [
      {
        // www.zanaris.rs serves the site directly today, so the same page can
        // be reached at two hostnames. That is a nuisance for canonical URLs
        // and a real problem for the website session cookie Part 2 adds: it is
        // host-only (no Domain attribute), so a login on the apex is invisible
        // on www and the reader is silently signed out by a link.
        source: "/:path*",
        has: [{ type: "host", value: "www.zanaris.rs" }],
        destination: "https://zanaris.rs/:path*",
        permanent: true, // 308: keeps the method, and browsers cache it
      },
      {
        // The record board is a hiscores page and moved under them a day
        // after it launched; links to the old address keep working. The query
        // (`?category=9`) is passed through, so a shared board still opens on
        // the same skill.
        source: "/records",
        destination: "/hiscores/records",
        permanent: true,
      },
      {
        // The Adventurer Log launched at `/adventurer-log/<name>` and moved to
        // `/adventurer/<name>` (with the directory at `/adventurers`) a day
        // later, for a shorter address to share. The old links keep working;
        // `lib/adventurer-log/href.ts` is where the new ones come from.
        source: "/adventurer-log",
        destination: "/adventurers",
        permanent: true,
      },
      {
        source: "/adventurer-log/:username",
        destination: "/adventurer/:username",
        permanent: true,
      },
    ];
  },

  async headers() {
    return [
      {
        // The map data the applet fetches. It is a 425 KB Jagex archive, not
        // anything a browser should try to interpret, and it only changes when
        // the content maps do — so it is typed as a plain byte stream and
        // cached hard, with a day of stale-while-revalidate behind it.
        source: "/worldmap.jag",
        headers: [
          { key: "Content-Type", value: "application/octet-stream" },
          {
            key: "Cache-Control",
            value: "public, max-age=3600, stale-while-revalidate=86400",
          },
        ],
      },
      {
        // The applet itself: outside the Next bundle (see
        // components/worldmap/WorldMapCanvas.tsx), so it needs its own
        // caching rather than a build-hashed filename.
        source: "/js/mapview.js",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=3600, stale-while-revalidate=86400",
          },
        ],
      },
      {
        // The game icons (see "Game icons" in the README). Static files
        // default to `max-age=0`, which is one re-check per file per page
        // view, and /economy puts about 130 of them on a page — so the
        // default costs a hundred-odd requests for pictures that change only
        // when someone repacks the engine and re-runs `icons:update`.
        //
        // A year, and immutable: never re-checked. The filenames are object
        // ids rather than content hashes, so that is only safe because
        // `itemIconSrc` / `skillIconSrc` put the generated set's version in
        // the URL (`?v=`). A regeneration changes the version, so it changes
        // every URL and reaches readers at once, which a shorter max-age
        // could not do anyway — nothing can purge a browser cache.
        //
        // This also covers a hand-written path with no `?v=`, which would be
        // cached for a year and never corrected. Don't write one: the README
        // and the icons skill both say to call the helpers.
        source: "/img/game/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        // The game's own webfonts (scripts/game-fonts/build.ts). Unlike the
        // chathead renderer and the icons, a plain CSS `@font-face` `src`
        // cannot carry a `?v=` — nothing in game-fonts.css can read
        // metrics.json's version — so the URL never changes when the fonts
        // are regenerated. A year-long immutable cache would then serve a
        // stale font forever; this revalidates hourly instead. There is no
        // broader `/game/:path*` rule for this to collide with today, but if
        // one is ever added, it must come before this entry: Next applies
        // every matching rule for a path and a later one wins on repeated
        // keys, so the narrower, shorter-cache rule for fonts has to be last.
        source: "/game/fonts/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=3600, must-revalidate",
          },
        ],
      },
      {
        // The chathead renderer and what it draws from — `models.bin` for
        // chatheads, `bodies.bin` for figures (`scripts/update-chathead.sh`)
        // — on the same terms as the icons: `lib/chathead/load.ts` asks for
        // each with its build's `?v=`, so a year is safe and a regeneration
        // reaches readers at once.
        source: "/game/chathead/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      // The Adventurer Log draws an owner's own stylesheet
      // (lib/adventurer-log/css.ts). The sanitiser already refuses anything
      // that loads from elsewhere; this is the backstop if it ever misses:
      // pictures and fonts from this site only, and styles from this site or
      // inline - which also refuses a remote @import. Scripts and connections
      // are left alone: the page loads the chathead renderer from here, and
      // nothing an owner writes can add a script.
      //
      // Every link into and out of a log is a plain <a> (the site's rule), so
      // this header is on every log a reader sees and on nothing else.
      ...["/adventurer/:path*"].map((source) => ({
        source,
        headers: [
          {
            key: "Content-Security-Policy",
            value: "img-src 'self'; font-src 'self'; style-src 'self' 'unsafe-inline'",
          },
        ],
      })),
      // Nothing signed in may be framed. `SameSite=Lax` keeps the session
      // cookie out of a frame on *another* site, but not out of one on a
      // sibling host: `www.zanaris.rs` and the `*.04.zanaris.rs` worlds are
      // same-site, so a page there framing `https://zanaris.rs/account` gets
      // the cookie sent with it. That is a signed-in account centre inside
      // somebody else's layout, which is one invisible frame away from a
      // reader pressing "Change email", or a moderator pressing a staff
      // control, without seeing what they pressed. Neither Lax nor the Origin
      // check on the POST prevents the click; this does.
      //
      // `frame-ancestors 'none'` rather than `X-Frame-Options: DENY`: it is
      // the header that is actually specified, it covers every ancestor rather
      // than just the parent, and it cannot be overridden by a `<meta>` tag.
      //
      // The public half of the site is deliberately left framable: /worldmap,
      // /hiscores and the news pages are things people embed, and there is no
      // cookie behind them to abuse. Both the bare path and the subtree are
      // listed because they are two matches, not one.
      ...[
        "/account",
        "/account/:path*",
        "/messages",
        "/messages/:path*",
        "/staff",
        "/staff/:path*",
      ].map((source) => ({
        source,
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'none'",
          },
        ],
      })),
      {
        // The log's settings page holds the owner's stylesheet in a code
        // editor (components/adventurer-log/CssEditor.tsx) and draws none of
        // it, but it keeps the log's backstop all the same: it costs nothing,
        // and the page is one change away from drawing a stylesheet pasted
        // in from someone else. `data:` pictures as well, because the code
        // editor draws its own lint marks with them; nothing an owner writes
        // can use one (the sanitiser lets through /img/ and nothing else).
        //
        // After the /account entries, and repeating their frame-ancestors:
        // two entries that set the same header on one path do not merge, the
        // later one wins.
        source: "/account/adventurer-log",
        headers: [
          {
            key: "Content-Security-Policy",
            value:
              "frame-ancestors 'none'; img-src 'self' data:; font-src 'self'; style-src 'self' 'unsafe-inline'",
          },
        ],
      },
      {
        // The Character tab draws the log's own card and dialogue box, with
        // the owner's words in them, so it takes the log's policy - and,
        // for the same reason as the entry above, repeats the account pages'
        // frame-ancestors, which this entry would otherwise replace.
        source: "/account/adventurer-log/character",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'none'; img-src 'self'; font-src 'self'; style-src 'self' 'unsafe-inline'",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
