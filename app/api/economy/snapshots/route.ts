import type { NextRequest } from "next/server";

import {
  economyError,
  economyPreflight,
  economyResponse,
  parseEconomyParams,
  snapshotsEtag,
  toSnapshotsResponse,
} from "@/lib/public/api";
import { loadEconomySnapshots } from "@/lib/public/read-server";

/**
 * `GET /api/economy/snapshots?window=30-days&tracked=false`
 *
 * The hourly series over a window: players and coins on every census, and the
 * tracked rares alongside them when `tracked=true` asks for those too.
 *
 * `window` is one of the four slugs the pages use and defaults to thirty days
 * — including `30-days` itself, which is a 404 on the site because `/economy`
 * *is* that window and may not have two URLs. A query parameter has no
 * canonical-URL problem, so the API answers to the name rather than refusing
 * the spelling a reader is most likely to reach for.
 *
 * An empty window is a 200 with no rows: a server whose census has not run is
 * not a fault.
 */
export async function GET(request: NextRequest) {
  const parsed = parseEconomyParams(request.nextUrl.searchParams);
  if (!parsed.ok) {
    return economyError(400, parsed.error);
  }

  const { window, tracked } = parsed.value;
  const load = await loadEconomySnapshots(window);

  if (load.status !== "ok") {
    return economyError(503, "unavailable");
  }

  return economyResponse(
    toSnapshotsResponse(window, load.data, tracked),
    snapshotsEtag(window, load.data, tracked),
    request.headers.get("if-none-match"),
  );
}

export function OPTIONS() {
  return economyPreflight();
}
