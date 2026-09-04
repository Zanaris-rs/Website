import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The site runs on Vercel as a Node app: hiscores and registration are
  // server-side route handlers, so there is no static export any more.
  trailingSlash: false,
  images: { unoptimized: true },
};

export default nextConfig;
