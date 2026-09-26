import type { NextRequest } from "next/server";

import {
  economyPreflight,
  economyResponse,
  spawnsEtag,
  toSpawnsResponse,
} from "@/lib/public/api";
import { loadSpawnRecord } from "@/lib/public/read-server";

/**
 * `GET /api/economy/spawns`
 *
 * Every item staff have conjured into the economy with `::give` and friends,
 * and the aggregate over the same rows. No names, by the same decision the
 * page made.
 *
 * This is the endpoint whose interesting answer is nought. `allTime` is on
 * every response because the all-time and the ninety-day reads return the
 * same four columns: rows alone cannot say which they came from, and a
 * consumer printing "ever" over a windowed read would make a claim the data
 * does not support.
 *
 * `loadSpawnRecord` degrades rather than failing — it falls back through two
 * all-time reads to a windowed one — so there is no 503 here. A response with
 * `total: null` and `spawns: null` is it reporting that nothing came back,
 * which is a truthful answer and one a caller can act on.
 */
export async function GET(request: NextRequest) {
  const record = await loadSpawnRecord({ rows: true });

  return economyResponse(
    toSpawnsResponse(record),
    spawnsEtag(record),
    request.headers.get("if-none-match"),
  );
}

export function OPTIONS() {
  return economyPreflight();
}
