/**
 * The places an adventurer can call home, and (from W6) stand in. The
 * database checks only a key's shape; this list is the truth, and a key not
 * on it is ignored wherever it is drawn.
 */
export const PLACES = [
  { key: "lumbridge", name: "Lumbridge" },
  { key: "varrock", name: "Varrock" },
  { key: "falador", name: "Falador" },
  { key: "draynor", name: "Draynor Village" },
  { key: "al_kharid", name: "Al Kharid" },
  { key: "edgeville", name: "Edgeville" },
  { key: "port_sarim", name: "Port Sarim" },
  { key: "barbarian_village", name: "Barbarian Village" },
  { key: "karamja", name: "Karamja" },
  { key: "catherby", name: "Catherby" },
  { key: "seers_village", name: "Seers' Village" },
  { key: "ardougne", name: "Ardougne" },
  { key: "yanille", name: "Yanille" },
  { key: "canifis", name: "Canifis" },
  { key: "taverley", name: "Taverley" },
  { key: "wilderness", name: "the Wilderness" },
] as const;

export type PlaceKey = (typeof PLACES)[number]["key"];

export function isPlace(key: unknown): key is PlaceKey {
  return PLACES.some((place) => place.key === key);
}

export function placeName(key: string | null): string | null {
  return PLACES.find((place) => place.key === key)?.name ?? null;
}
