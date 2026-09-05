import type { Metadata, Viewport } from "next";

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

/**
 * The whole site is a fixed 600px column of 2004 furniture — edge tiles,
 * 500px panels, 100px stone captions — and none of it can reflow, because the
 * pictures are the layout. On a phone the choice is therefore between clipping
 * the right-hand edge and scaling the page down, and the original made the
 * same choice we do: its own `<meta viewport>` carried `initial-scale=0.7`.
 *
 * `width: 600` hands the browser a 600px layout viewport and lets it scale to
 * whatever the screen is, so a 375px phone sees the entire page at 62% rather
 * than two thirds of it at 100%. Desktop browsers ignore the tag entirely.
 */
export const viewport: Viewport = {
  width: 600,
  // Next's default is `initial-scale=1`, which would pin the page at 100% and
  // put a third of it off-screen. Undefined leaves the tag without a scale, so
  // the browser picks the one that makes 600px fit whatever screen it has.
  initialScale: undefined,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
