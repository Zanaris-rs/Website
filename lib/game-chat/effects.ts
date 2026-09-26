/**
 * The game's overhead chat, as the client draws it (Client-TS `Client.ts`,
 * the chat loop after `sceneCycle++`): six fixed colours, three flashes and
 * three glows, and the wave and scroll effects. The client runs at 50 cycles
 * a second; a public chat line lives 150 of them, and its glow and scroll
 * run once over that life. On a log the line never expires, so both loop.
 */

export const CHAT_COLOUR_NAMES = [
  "yellow", "red", "green", "cyan", "purple", "white",
  "flash1", "flash2", "flash3", "glow1", "glow2", "glow3",
] as const;
export const CHAT_EFFECT_NAMES = ["none", "wave", "scroll"] as const;

/** One client cycle. */
export const CYCLE_MS = 20;
/** A chat line's life in cycles: `chatTimer` starts at 150. */
export const CHAT_LIFE = 150;

const FIXED = [0xffff00, 0xff0000, 0x00ff00, 0x00ffff, 0xff00ff, 0xffffff];

export function colourAt(colour: number, cycle: number): number {
  if (colour >= 0 && colour < 6) return FIXED[colour];
  const first = cycle % 20 < 10;
  if (colour === 6) return first ? 0xff0000 : 0xffff00;
  if (colour === 7) return first ? 0x0000ff : 0x00ffff;
  if (colour === 8) return first ? 0x00b000 : 0x80ff80;

  // 150 - chatTimer, looped
  const delta = ((cycle % CHAT_LIFE) + CHAT_LIFE) % CHAT_LIFE;
  if (colour === 9) {
    if (delta < 50) return delta * 1280 + 0xff0000;
    if (delta < 100) return 0xffff00 - (delta - 50) * 327680;
    return (delta - 100) * 5 + 0x00ff00;
  }
  if (colour === 10) {
    if (delta < 50) return delta * 5 + 0xff0000;
    if (delta < 100) return 0xff00ff - (delta - 50) * 327680;
    return (delta - 100) * 327680 + 0x0000ff - (delta - 100) * 5;
  }
  if (colour === 11) {
    if (delta < 50) return 0xffffff - delta * 327685;
    if (delta < 100) return (delta - 50) * 327685 + 0x00ff00;
    return 0xffffff - (delta - 100) * 327680;
  }
  return 0xffff00;
}

/** `PixFont.centreStringWave`: each character's drop, in pixels. */
export function waveOffset(index: number, cycle: number): number {
  return Math.trunc(Math.sin(index / 2 + cycle / 5) * 5);
}

/**
 * How far scroll has moved the text left, in pixels. The client shows it
 * through a 100 px window centred on the speaker, starting at the window's
 * right edge.
 */
export function scrollOffset(textWidth: number, cycle: number): number {
  const delta = ((cycle % CHAT_LIFE) + CHAT_LIFE) % CHAT_LIFE;
  return Math.trunc((delta * (textWidth + 100)) / CHAT_LIFE);
}

export function cssColour(rgb: number): string {
  return `#${(rgb & 0xffffff).toString(16).padStart(6, "0")}`;
}
