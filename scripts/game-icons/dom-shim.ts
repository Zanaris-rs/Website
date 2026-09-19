/**
 * Client-TS's `graphics/Jpeg.ts` creates a canvas and an <img> the moment it
 * is loaded, and `Pix32` imports it, so importing the item renderer under bun
 * would throw on `document`. Nothing here decodes a JPEG, so these stand-ins
 * only have to survive being created. This module must be imported before
 * any Client-TS module: ES modules evaluate in import order.
 */

const element = { getContext: () => ({}) };

(globalThis as Record<string, unknown>).document ??= {
  createElement: () => element,
};
