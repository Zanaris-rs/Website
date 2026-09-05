import type { Colour } from "@/lib/colour";

import frame from "./Frame.module.css";

/**
 * Each of the original's nine link colours, as the class name that paints it.
 * The names themselves are `lib/colour.ts`, so data modules can carry a colour
 * without depending on a stylesheet.
 */
export const colourClass: Record<Colour, string> = {
  white: frame.white,
  red: frame.red,
  lblue: frame.lblue,
  dblue: frame.dblue,
  yellow: frame.yellow,
  green: frame.green,
  purple: frame.purple,
  pink: frame.pink,
  orange: frame.orange,
};

export type { Colour };
