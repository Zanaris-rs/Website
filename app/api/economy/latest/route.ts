import type { NextRequest } from "next/server";

import {
  economyError,
  economyPreflight,
  economyResponse,
  latestEtag,
  toLatestResponse,
} from "@/lib/public/api";
import { loadEconomyLatest } from "@/lib/public/read-server";

/**
 * `GET /api/economy/latest`
 *
 * The newest hourly census whole: how many save files there are, how many
 * coins are in them, and every object in the game with a count against it.
 *
 * No window parameter, for the reason `public_economy_latest()` takes none —
 * how much iron ore exists has one answer whichever window you are looking at.
 *
 * It reads `loadEconomyLatest` rather than the catalogue loader /economy/items
 * shares, because that one folds "the census has not run" into "unavailable".
 * That fold is right for a page and wrong for an API: no census yet is a 200
 * describing a young server, and only a read that could not be made is a 503.
 */
export async function GET(request: NextRequest) {
  const load = await loadEconomyLatest();

  if (load.status !== "ok") {
    return economyError(503, "unavailable");
  }

  return economyResponse(
    toLatestResponse(load.data),
    latestEtag(load.data),
    request.headers.get("if-none-match"),
  );
}

export function OPTIONS() {
  return economyPreflight();
}
