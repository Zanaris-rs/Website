import type { PlaceKey } from "../../lib/adventurer-log/places.ts";

/**
 * Where each scene is shot from. `x`/`z`/`level` is the tile the figure
 * stands on; the camera follows it the way the game's does (camFollow) at
 * `pitch` (the game allows 128-383; lower is eye-level, see visBacking in
 * render.ts) and `yaw` (0 looks north), `dist` scene units away (128 a
 * tile), aimed `lift` above the ground. The figure's own yaw faces the
 * camera: (2048 - yaw) & 2047.
 *
 * A place with no entry stays a home town without a scene (the spec): only
 * places that frame well at 240x300, with nothing between the figure and the
 * camera, are listed. `npm run scenes:update` proves the second part and
 * writes `scripts/scenes/contact-sheet.png` to judge the first by eye.
 */
export type SpotInput = {
  key: PlaceKey;
  name: string;
  x: number;
  z: number;
  level: number;
  pitch: number;
  yaw: number;
  dist: number;
  lift: number;
};

export const SPOTS: SpotInput[] = [
  { key: "varrock", name: "Varrock square", x: 3212, z: 3424, level: 0, pitch: 64, yaw: 0, dist: 1000, lift: 230 },
  { key: "lumbridge", name: "Lumbridge castle", x: 3222, z: 3218, level: 0, pitch: 0, yaw: 512, dist: 1000, lift: 230 },
  { key: "falador", name: "Falador park", x: 2995, z: 3376, level: 0, pitch: 32, yaw: 1024, dist: 1000, lift: 230 },
  { key: "wilderness", name: "the Wilderness border", x: 3092, z: 3528, level: 0, pitch: 64, yaw: 0, dist: 1000, lift: 230 },
  { key: "draynor", name: "Draynor market", x: 3082, z: 3248, level: 0, pitch: 64, yaw: 512, dist: 1000, lift: 230 },
  { key: "catherby", name: "Catherby beach", x: 2830, z: 3435, level: 0, pitch: 64, yaw: 512, dist: 1000, lift: 230 },
  { key: "al_kharid", name: "Al Kharid palace", x: 3293, z: 3176, level: 0, pitch: 64, yaw: 1024, dist: 1000, lift: 230 },
  { key: "edgeville", name: "Edgeville", x: 3089, z: 3488, level: 0, pitch: 64, yaw: 0, dist: 1000, lift: 230 },
  { key: "port_sarim", name: "Port Sarim docks", x: 3029, z: 3218, level: 0, pitch: 64, yaw: 1536, dist: 1000, lift: 230 },
  { key: "barbarian_village", name: "Barbarian Village", x: 3079, z: 3425, level: 0, pitch: 64, yaw: 0, dist: 1000, lift: 230 },
  { key: "karamja", name: "the banana plantation", x: 2920, z: 3162, level: 0, pitch: 64, yaw: 0, dist: 1000, lift: 230 },
  { key: "seers_village", name: "Seers' Village", x: 2738, z: 3479, level: 0, pitch: 64, yaw: 512, dist: 1000, lift: 230 },
  { key: "ardougne", name: "Ardougne market", x: 2662, z: 3305, level: 0, pitch: 64, yaw: 0, dist: 1000, lift: 230 },
  { key: "yanille", name: "the Wizards' Guild", x: 2606, z: 3098, level: 0, pitch: 32, yaw: 832, dist: 1000, lift: 230 },
  { key: "canifis", name: "Canifis", x: 3491, z: 3491, level: 0, pitch: 64, yaw: 1024, dist: 1000, lift: 230 },
  { key: "taverley", name: "the druids' circle", x: 2925, z: 3478, level: 0, pitch: 64, yaw: 0, dist: 1000, lift: 230 },
];
