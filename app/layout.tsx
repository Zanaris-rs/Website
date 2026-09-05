import type { Metadata } from "next";

import "./globals.css";

/**
 * The origin every relative URL in a `Metadata` object is resolved against —
 * Open Graph images, canonicals, anything a crawler or a link preview reads.
 * Next warns on every build without it and then guesses `localhost:3000`,
 * which is how a share card ends up pointing at a machine nobody else has.
 *
 * `SITE_URL` is set on Vercel and documented in `.env.example`; it did nothing
 * until now. The fallback is the real origin rather than a localhost default,
 * so a preview deploy that forgets the variable still produces links that
 * work. A malformed value is ignored rather than failing the build: a typo in
 * an environment variable should not take the whole site down over a link
 * preview.
 */
function siteUrl(): URL {
  const fallback = "https://zanaris.rs";
  const configured = process.env.SITE_URL?.trim();
  if (!configured) {
    return new URL(fallback);
  }

  try {
    return new URL(configured);
  } catch {
    console.warn(`[layout] SITE_URL is not a URL; falling back to ${fallback}`);
    return new URL(fallback);
  }
}

export const metadata: Metadata = {
  metadataBase: siteUrl(),
  // Every page below sets a bare title and gets the suffix from the template;
  // a page that wants the whole tab to itself (the disclaimer, the title
  // screen) sets `title: { absolute: … }`. Nothing hardcodes " | Zanaris"
  // any more, because a template plus a hardcoded suffix doubles it.
  title: { default: "Zanaris", template: "%s | Zanaris" },
  description:
    "A free Lost City (2004scape) server. Play RuneScape as it was in 2004, in your browser.",
};

/*
 * There is no `viewport` export any more, on purpose. The site used to pin the
 * layout viewport to 600px so that phones scaled the whole 2004 column down
 * instead of clipping it; the frame is fluid now (`components/site/Frame.tsx`)
 * and every page reflows, so Next's default `width=device-width,
 * initial-scale=1` is the right tag.
 */

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
