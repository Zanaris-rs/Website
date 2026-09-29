/**
 * A deterministic box-filter downsample, shared by everywhere the game-icon
 * generator averages many source pixels down to one: `render.ts`'s object
 * tiles (`SUPERSAMPLE` x `SUPERSAMPLE`) and `community.ts`'s crop of the
 * clan photo (`CROP.scale`). The rule is the same either way: sum each
 * channel over a `scale`x`scale` block of source pixels, floor the average,
 * and pack it back to `0xRRGGBB` - substituting `BLACK` for a result of 0,
 * since 0 is the PNG encoder's transparent (`png.ts`).
 */

/** The client's black: 0 is the PNG encoder's transparent, so black is 1. */
export const BLACK = 1;

/**
 * `width` and `height` are the downsampled *output* size; `scale` source
 * pixels make one output pixel on each axis. `read(x, y)` returns one
 * source pixel at source coordinates `(x, y)` - the caller's `read` already
 * carries whatever offset the source needs (a supersample origin, a crop),
 * so this function only ever counts up from 0.
 */
export function boxAverage(
  read: (x: number, y: number) => number,
  width: number,
  height: number,
  scale: number,
): Int32Array {
  const block = scale * scale;
  const out = new Int32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let red = 0;
      let green = 0;
      let blue = 0;
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const rgb = read(x * scale + dx, y * scale + dy);
          red += (rgb >> 16) & 0xff;
          green += (rgb >> 8) & 0xff;
          blue += rgb & 0xff;
        }
      }
      const rgb = (((red / block) | 0) << 16) | (((green / block) | 0) << 8) | ((blue / block) | 0);
      out[x + y * width] = rgb === 0 ? BLACK : rgb;
    }
  }
  return out;
}
