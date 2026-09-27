import { CHAT_COLOUR_NAMES } from "./effects";

/**
 * The client's own chat prefixes (Client.ts, sending MESSAGE_PUBLIC): each
 * colour prefix is checked once, in order, and stripped if present, then
 * `wave:` and `scroll:` the same way. Typing them into the editor sets the
 * pickers, as typing them in game did.
 */
export function parseChatPrefix(input: string): { colour: number; effect: number; text: string } {
  let text = input;
  let colour = 0;
  CHAT_COLOUR_NAMES.forEach((name, index) => {
    if (text.startsWith(`${name}:`)) {
      colour = index;
      text = text.substring(name.length + 1);
    }
  });
  let effect = 0;
  if (text.startsWith("wave:")) {
    effect = 1;
    text = text.substring(5);
  }
  if (text.startsWith("scroll:")) {
    effect = 2;
    text = text.substring(7);
  }
  return { colour, effect, text };
}

export function chatPrefix(colour: number, effect: number): string {
  const colourPart = colour > 0 && colour < CHAT_COLOUR_NAMES.length ? `${CHAT_COLOUR_NAMES[colour]}:` : "";
  const effectPart = effect === 1 ? "wave:" : effect === 2 ? "scroll:" : "";
  return colourPart + effectPart;
}
