import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The site runs on Vercel as a Node app: hiscores and registration are
  // server-side route handlers, so there is no static export any more.
  trailingSlash: false,
  images: { unoptimized: true },

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
        // The chathead renderer and its models (`scripts/update-chathead.sh`),
        // on the same terms as the icons: `lib/chathead/load.ts` asks for
        // both with the build's `?v=`, so a year is safe and a regeneration
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
      ...["/adventurer-log/:path*"].map((source) => ({
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
    ];
  },
};

export default nextConfig;
