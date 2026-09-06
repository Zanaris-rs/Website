import { ECONOMY_FLOW_ROW_LIMIT, type Flow, type Snapshot } from "@/lib/public/queries";

/**
 * The maths behind /economy: the shape of a line, and a month of hourly
 * censuses folded into days.
 *
 * All of it is pure, because all of it is testable that way and none of it
 * needs to know what an SVG is. `components/public/EconomyChart.tsx` turns
 * what `chartPath` returns into elements and does no arithmetic of its own.
 */

/* --- the series --- */

export type Point = {
  /** ISO instant. */
  readonly at: string;
  readonly value: number;
};

export type Chart = {
  /** An SVG path in a `0 0 width height` box, oldest sample on the left. */
  readonly path: string;
  /** The same points as a closed shape down to the baseline, for a soft fill. */
  readonly area: string;
  readonly min: number;
  readonly max: number;
  readonly first: Point;
  readonly last: Point;
  readonly count: number;
};

/** Points a snapshot series can be drawn from, dropping the hours that counted nothing. */
export function seriesOf(
  snapshots: readonly Snapshot[],
  pick: (snapshot: Snapshot) => number | null,
): Point[] {
  const points: Point[] = [];
  for (const snapshot of snapshots) {
    const value = pick(snapshot);
    if (value === null || snapshot.takenAt === null) continue;
    points.push({ at: snapshot.takenAt, value });
  }
  return points;
}

/**
 * A polyline through the points, scaled to fill the box.
 *
 * Two cases are not corner cases here, because until the census has run for a
 * while they are the *normal* ones:
 *
 * - **No points at all** returns `null`, and the page draws its empty state
 *   rather than an axis with nothing on it.
 * - **Every point equal** (or a single point) draws a flat line down the
 *   middle rather than dividing by a zero range. A server whose coin total has
 *   not moved in a day should show a straight line, which is the truth, not a
 *   spike.
 *
 * The vertical scale is the data's own min and max, not zero-based: hour to
 * hour the interesting thing is the movement, and a coin total of 41 million
 * against a zero baseline is a straight line however much it moved. The page
 * prints both numbers underneath so nobody has to guess the scale.
 */
export function chartPath(
  points: readonly Point[],
  width: number,
  height: number,
  inset = 1,
): Chart | null {
  if (points.length === 0) return null;

  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const top = inset;
  const bottom = height - inset;

  const x = (index: number) =>
    points.length === 1 ? width / 2 : (index / (points.length - 1)) * width;
  const y = (value: number) =>
    max === min
      ? (top + bottom) / 2
      : bottom - ((value - min) / (max - min)) * (bottom - top);

  const round = (n: number) => Math.round(n * 100) / 100;
  const steps = points.map(
    (point, index) => `${round(x(index))} ${round(y(point.value))}`,
  );

  // A single sample has no line to draw, so it gets a short horizontal one
  // through its own point: an invisible chart reads as a broken one.
  const path =
    steps.length === 1
      ? `M 0 ${steps[0].split(" ")[1]} L ${width} ${steps[0].split(" ")[1]}`
      : `M ${steps.join(" L ")}`;

  const area = `${path} L ${round(width)} ${height} L 0 ${height} Z`;

  return {
    path,
    area,
    min,
    max,
    first: points[0],
    last: points[points.length - 1],
    count: points.length,
  };
}

/* --- what entered and left --- */

/** The UTC day an instant falls in, `YYYY-MM-DD`. */
export function utcDay(iso: string | null): string | null {
  if (!iso) return null;
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return null;
  return when.toISOString().slice(0, 10);
}

export type DayFlow = {
  /** `YYYY-MM-DD`, UTC. */
  readonly day: string;
  readonly items: readonly { readonly itemId: number; readonly delta: number }[];
};

export type FlowDays = {
  /** Newest day first. Every one of them is a whole day. */
  readonly days: readonly DayFlow[];
  /**
   * True when the read came back at the SQL's row ceiling, so days older than
   * the last one here exist and were never loaded.
   */
  readonly truncated: boolean;
};

/**
 * A month of hourly flow rows as days.
 *
 * The census runs hourly and writes a row per tracked item that moved, so a
 * raw list is hundreds of lines of "+1, -1, +1" that mean nothing on their
 * own. Summing per item per day is what turns them into the sentence the page
 * wants: *on 4 September, one blue partyhat left the game*.
 *
 * A day where an item entered and left in equal number sums to zero and is
 * dropped — nothing happened to it that day, whatever the rows say — and a day
 * left with nothing at all is dropped too. Newest day first, and within a day
 * the biggest movement first.
 *
 * ## When there were more rows than the function will return
 *
 * `public_economy_flow` is `ORDER BY taken_at DESC ... LIMIT 5000`, so a month
 * busier than the ceiling arrives with its oldest rows missing — and the cut
 * lands in the middle of a day, not between two. Folding that as it stands
 * publishes a part of a day as the whole of one: "on 12 August, four whips
 * left the game" when nine did, in a table whose entire purpose is being
 * checkable from outside the server.
 *
 * So the oldest day of a full read is dropped rather than half-reported, and
 * `truncated` says the rest is a window rather than the month. The page prints
 * that; it does not print a wrong number and hope.
 */
export function dailyFlows(flows: readonly Flow[]): FlowDays {
  const truncated = flows.length >= ECONOMY_FLOW_ROW_LIMIT;

  // Which day the cut landed in. Computed from the rows rather than taken from
  // the last of them, because a pure function of a list should not depend on
  // the order the caller happened to fetch it in.
  let partial: string | null = null;
  if (truncated) {
    for (const flow of flows) {
      const day = utcDay(flow.takenAt);
      if (day === null) continue;
      if (partial === null || day < partial) partial = day;
    }
  }

  const days = new Map<string, Map<number, number>>();

  for (const flow of flows) {
    const day = utcDay(flow.takenAt);
    if (day === null || day === partial) continue;
    let items = days.get(day);
    if (!items) {
      items = new Map();
      days.set(day, items);
    }
    items.set(flow.itemId, (items.get(flow.itemId) ?? 0) + flow.delta);
  }

  const out: DayFlow[] = [];
  for (const [day, items] of days) {
    const kept = [...items]
      .filter(([, delta]) => delta !== 0)
      .map(([itemId, delta]) => ({ itemId, delta }))
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || a.itemId - b.itemId);
    if (kept.length > 0) out.push({ day, items: kept });
  }

  return {
    days: out.sort((a, b) => b.day.localeCompare(a.day)),
    truncated,
  };
}

/** The newest snapshot in a series, which is what "currently" means on the page. */
export function latestSnapshot(
  snapshots: readonly Snapshot[],
): Snapshot | null {
  return snapshots.length === 0 ? null : snapshots[snapshots.length - 1];
}

/**
 * The change in a value over the last day of the series.
 *
 * "Daily change" is the newest snapshot against the newest one that is at
 * least 24 hours older — not against the snapshot 24 rows back, because the
 * timer can miss an hour and a missed hour must not turn into a wrong figure.
 * `null` when the series does not reach back a day yet, which the page says
 * out loud instead of printing a zero.
 */
export function dailyChange(
  snapshots: readonly Snapshot[],
  pick: (snapshot: Snapshot) => number | null,
): number | null {
  const latest = latestSnapshot(snapshots);
  if (latest === null || latest.takenAt === null) return null;
  const now = new Date(latest.takenAt).getTime();
  const value = pick(latest);
  if (value === null || !Number.isFinite(now)) return null;

  for (let i = snapshots.length - 2; i >= 0; i--) {
    const older = snapshots[i];
    if (older.takenAt === null) continue;
    const then = new Date(older.takenAt).getTime();
    if (!Number.isFinite(then)) continue;
    if (now - then >= 24 * 60 * 60 * 1000) {
      const before = pick(older);
      return before === null ? null : value - before;
    }
  }

  return null;
}
