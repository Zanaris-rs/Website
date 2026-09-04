import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The site is served as static files by Caddy: no Node process at runtime.
  output: "export",
  trailingSlash: false,
  images: { unoptimized: true },
};

export default nextConfig;
