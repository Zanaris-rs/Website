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
