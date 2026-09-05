import frame from "./Frame.module.css";

/**
 * The nine link colours from the original's one-line stylesheet, by name.
 *
 * They are used for the news categories, the coloured lines in the disclaimer
 * and the red warnings on the rules page. The names are the original's class
 * names so a colour can be quoted from a 2004 page and used verbatim.
 */
export type Colour =
  | "white"
  | "red"
  | "lblue"
  | "dblue"
  | "yellow"
  | "green"
  | "purple"
  | "pink"
  | "orange";

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
