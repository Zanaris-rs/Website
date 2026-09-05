/* eslint-disable @next/next/no-img-element --
   The one place in the codebase that renders a bare <img>, so the exemption
   lives here and nowhere else.

   Every picture on this site is an exact-size 2004 tile that must not be
   re-encoded, resized or lazy-loaded: `next/image` would do all three and the
   seams between adjacent tiles would show. They are 1-7 KB each and purely
   decorative, so there is nothing for the optimiser to win either. */

/**
 * One 2004 graphic at its declared size.
 *
 * `width`/`height` are the *original's declared* sizes, which are not always
 * the file's natural ones — the two footer tiles are 100x77 files drawn at
 * 100x82, and the Secure Services tiles are 77x120 files drawn at 48x75.
 * Those declared sizes are what produce the 2004 geometry.
 */
export default function Tile({
  src,
  width,
  height,
  alt = "",
  className,
}: {
  src: string;
  width: number;
  height: number;
  alt?: string;
  className?: string;
}) {
  return (
    <img
      src={src}
      width={width}
      height={height}
      alt={alt}
      className={className}
    />
  );
}
