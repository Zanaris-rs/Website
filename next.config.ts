import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The site runs on Vercel as a Node app: hiscores and registration are
  // server-side route handlers, so there is no static export any more.
  trailingSlash: false,
  images: { unoptimized: true },

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
    ];
  },
};

export default nextConfig;
