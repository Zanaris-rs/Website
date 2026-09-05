/**
 * The nine link colours from the original's one-line stylesheet, by name.
 *
 * They are used for the news categories, the coloured lines in the disclaimer
 * and the red warnings on the rules page. The names are the original's own
 * class names, so a colour can be quoted from a 2004 page and used verbatim.
 *
 * The union lives here rather than beside the stylesheet that implements it so
 * that `lib/` — which is pure, unit-tested and knows nothing about React —
 * does not have to reach into `components/`. `components/site/colour.ts` maps
 * these names onto the CSS module's class names.
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
