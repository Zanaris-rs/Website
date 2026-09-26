import metrics from "./metrics.json";

export type GameFont = "b12" | "p12";
export const FONT_METRICS = metrics as {
  version: string;
  fonts: Record<GameFont, { height: number; advance: number[]; samples: Record<string, number> }>;
};
export const FONT_VERSION = FONT_METRICS.version;

/** `PixFont.stringWid`: advances summed, `@abc@` colour tags skipped. */
export function stringWidth(text: string, font: GameFont): number {
  const advance = FONT_METRICS.fonts[font].advance;
  let width = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "@" && i + 4 < text.length && text[i + 4] === "@") {
      i += 4;
    } else {
      width += advance[text.charCodeAt(i)] ?? 0;
    }
  }
  return width;
}
