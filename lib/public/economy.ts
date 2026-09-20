import { ECONOMY_FLOW_ROW_LIMIT, type Flow, type Snapshot, type TrackedItem } from "@/lib/public/queries";

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
  /**
   * Where each point was drawn vertically, in the box's own units.
   *
   * The hover readout puts a dot on the line, and it puts it here rather than
   * recomputing the scale in the browser: two implementations of the same
   * arithmetic are two chances to disagree, and a dot floating beside the line
   * it is supposed to be on is the kind of wrong a reader notices and cannot
   * explain. Rounded exactly as the path is, so they cannot drift apart.
   */
  readonly ys: readonly number[];
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
 * Several series over one shared time axis.
 *
 * Returns one `Point[]` per pick, every one the same length and naming the same
 * instants in the same order — so index *i* is the same hour in all of them.
 *
 * `seriesOf` drops the hours *its own* pick could not read, and `coins` and
 * `players` are independently nullable, so two series built with it can come
 * back different lengths. `chartPath` spaces points by index, so index 40 would
 * then be a different hour in each chart: two charts drawn from the same census
 * would silently disagree about what is under a given x, and a crosshair shared
 * between them would point at two different times.
 *
 * An hour is kept only when *every* pick reads a number from it. That is the
 * intersection rather than the union, and it is the stricter choice on purpose:
 * losing an hour from one chart because the other could not be read costs a
 * point nobody can see, and buys two charts that are honestly comparable.
 */
export function alignedSeries(
  snapshots: readonly Snapshot[],
  picks: readonly ((snapshot: Snapshot) => number | null)[],
): Point[][] {
  const series: Point[][] = picks.map(() => []);

  for (const snapshot of snapshots) {
    if (snapshot.takenAt === null) continue;
    const values = picks.map((pick) => pick(snapshot));
    if (values.some((value) => value === null)) continue;
    values.forEach((value, index) => {
      series[index].push({ at: snapshot.takenAt as string, value: value as number });
    });
  }

  return series;
}

/**
 * How many readings a chart hands the browser.
 *
 * The three shorter windows are under this, so they travel whole and the
 * crosshair can name every census the server took. Ninety days is 2,160
 * readings and would be the largest thing on the page by a wide margin.
 */
export const CHART_MAX_POINTS = 720;

/**
 * At most `max` readings, evenly spaced, first and last always kept.
 *
 * Only the 90-day window is ever over the cap, and it reduces three to one —
 * a reading every three hours instead of every hour. That is finer than the
 * chart can draw it: 880 pixels across 2,160 readings is a quarter of a pixel
 * each, so the points being dropped were already sharing a column with the
 * ones being kept.
 *
 * It picks readings rather than averaging them, and that is the whole point.
 * An average is a number the census never recorded, and the crosshair would
 * then name an hour and show a figure that was never true of it. Every value
 * here is one the server actually counted.
 *
 * Selection is by index, so two series of the same length — which is what
 * `alignedSeries` guarantees — reduce to the same instants and stay aligned.
 */
export function chartSeries(
  points: readonly Point[],
  max: number = CHART_MAX_POINTS,
): Point[] {
  if (points.length <= max) return [...points];
  if (max <= 1) return points.length === 0 ? [] : [points[points.length - 1]];

  const last = points.length - 1;
  const kept: Point[] = [];
  for (let i = 0; i < max; i++) {
    kept.push(points[Math.round((i / (max - 1)) * last)]);
  }
  return kept;
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
  /**
   * Scale to this instead of the points' own range.
   *
   * Two lines in one box have to be measured against the same ruler. Drawn
   * separately they each fill the box, so a trend line sitting well below the
   * readings it averages would be drawn right through the middle of them — the
   * picture would be of two series that agree, which is not what happened.
   */
  range?: { min: number; max: number },
): Chart | null {
  if (points.length === 0) return null;

  const values = points.map((point) => point.value);
  const min = range ? range.min : Math.min(...values);
  const max = range ? range.max : Math.max(...values);
  const top = inset;
  const bottom = height - inset;

  const x = (index: number) =>
    points.length === 1 ? width / 2 : (index / (points.length - 1)) * width;
  const y = (value: number) =>
    max === min
      ? (top + bottom) / 2
      : bottom - ((value - min) / (max - min)) * (bottom - top);

  const round = (n: number) => Math.round(n * 100) / 100;
  const ys = points.map((point) => round(y(point.value)));
  const steps = points.map((point, index) => `${round(x(index))} ${ys[index]}`);

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
    ys,
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

/* --- the categories --- */

/** The lowest and highest a series reached, without building a chart for it. */
export function rangeOf(
  points: readonly Point[],
): { low: number; high: number } | null {
  if (points.length === 0) return null;
  const values = points.map((point) => point.value);
  return { low: Math.min(...values), high: Math.max(...values) };
}

/**
 * A census with every bank note counted as the object it is a note for.
 *
 * A note is redeemable one for one at any banker, so "how much iron ore exists"
 * has to include the noted iron ore or it is not the number a reader came for.
 * It also keeps the rares block from listing "Red partyhat" and "Red partyhat
 * (noted)" as two different rares.
 *
 * `baseIdOf` is passed in rather than imported so this file stays free of the
 * object tables — the same reason `chartPath` takes numbers and knows nothing
 * about SVG.
 */
export function foldNotes(
  items: readonly TrackedItem[],
  baseIdOf: (id: number) => number,
): TrackedItem[] {
  const totals = new Map<number, number>();
  for (const item of items) {
    const id = baseIdOf(item.id);
    totals.set(id, (totals.get(id) ?? 0) + item.count);
  }
  return [...totals].map(([id, count]) => ({ id, count }));
}

/** What `economyBlocks` needs to know about an object. Supplied by `lib/items`. */
export type Catalogue = {
  readonly groupOf: (id: number) => string | null;
  readonly baseIdOf: (id: number) => number;
  readonly name: (id: number) => string;
  /** `null` for an object whose config declares no price — not zero, and never 1. */
  readonly cost: (id: number) => number | null;
};

/** One category, as the page needs it. `roster` is the ids it prints even at zero. */
export type BlockSpec = {
  readonly key: string;
  readonly label: string;
  readonly headline?: boolean;
  readonly roster: readonly number[] | null;
};

export type Block = {
  readonly key: string;
  readonly label: string;
  readonly headline: boolean;
  /** The rows to print, already ordered and capped. */
  readonly items: readonly { readonly id: number; readonly count: number }[];
  /** How many distinct objects the block actually holds. `items.length` when nothing was cut. */
  readonly of: number;
  /** Every one of them, added up. */
  readonly count: number;
  /**
   * `Σ count × cost` over the objects that declare a price, or `null` when not
   * one of them does — which is the rares block, and is why it carries no shop
   * value rather than carrying a made-up one.
   */
  readonly value: number | null;
  /** How many of the block's objects could be priced, and how many there were. */
  readonly priced: number;
  readonly counted: number;
  readonly low: number | null;
  readonly high: number | null;
};

/** How many rows a block prints before it says "top N of M". */
/**
 * What each item did over a set of flow rows, added up.
 *
 * `dailyFlows` groups by calendar day and is right for a list; this is for the
 * one line on the overview that says what moved in the last twenty-four hours,
 * where a day boundary in the middle would be an artefact of the clock rather
 * than a fact about the game.
 *
 * An item that went out and came back is not movement and is dropped: two
 * censuses apart, a partyhat that left one save and joined another nets to
 * nought, and printing "Blue partyhat, no change" as movement would be noise.
 *
 * Ordered by how far something moved rather than which way, because the
 * interesting row is the largest one either way.
 */
export function netFlows(
  flows: readonly Flow[],
): { itemId: number; delta: number }[] {
  const totals = new Map<number, number>();
  for (const flow of flows) {
    totals.set(flow.itemId, (totals.get(flow.itemId) ?? 0) + flow.delta);
  }

  return [...totals.entries()]
    .filter(([, delta]) => delta !== 0)
    .map(([itemId, delta]) => ({ itemId, delta }))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || a.itemId - b.itemId);
}

/**
 * How many readings the trend line averages over.
 *
 * Twelve hours: long enough that an hour where one player banked their whole
 * inventory does not become a feature of the shape, short enough that a day's
 * real movement still shows. The census is hourly, so this is the same span
 * whichever window is open — a trend that meant twelve hours on one tab and a
 * fortnight on another would not be one thing.
 */
export const TREND_SPAN = 12;

/**
 * The trailing average of each point and the ones before it.
 *
 * One point out for every point in, keeping each point's own instant, so it can
 * be drawn over the series it smooths and share its axis and its crosshair.
 *
 * The first few average what there is rather than nothing — a trend line that
 * begins twelve hours into a chart looks like the census started late. It is
 * trailing rather than centred because a centred average at the right-hand edge
 * would have to invent the readings after the last one, and the right-hand edge
 * is where a reader looks first.
 */
export function movingAverage(
  points: readonly Point[],
  span: number = TREND_SPAN,
): Point[] {
  const out: Point[] = [];
  let sum = 0;

  for (let i = 0; i < points.length; i++) {
    sum += points[i].value;
    if (i >= span) sum -= points[i - span].value;
    const over = Math.min(i + 1, span);
    out.push({ at: points[i].at, value: sum / over });
  }

  return out;
}

export const BLOCK_ROWS = 48;

/**
 * The census as the blocks the page prints.
 *
 * Notes are folded first, then every object is asked which category claims it,
 * and the leftovers become the residual block — keyed `"*"`, the same key
 * `accounts.public_economy_group_range` returns its low and high under, because
 * a minimum is not a subtraction and the residual's range has to be summed in
 * SQL rather than derived here.
 *
 * Ordering is per block and deliberate. A roster block is printed in name
 * order: it shows a line for something that does not exist, and rows that jump
 * about as counts change would make the zeroes hard to find. Every other block
 * is biggest first, because that is the question being asked of it.
 *
 * Blocks keep `specs` order, so the page does not reshuffle when the window
 * changes.
 */
export function economyBlocks(
  items: readonly TrackedItem[],
  ranges: ReadonlyMap<string, { low: number; high: number }> | null,
  specs: readonly BlockSpec[],
  catalogue: Catalogue,
  otherKey: string,
  otherLabel = "Other items",
): Block[] {
  const folded = foldNotes(items, catalogue.baseIdOf);

  const held = new Map<string, Map<number, number>>();
  for (const spec of specs) held.set(spec.key, new Map());
  held.set(otherKey, new Map());

  for (const item of folded) {
    if (item.count <= 0) continue;
    const key = catalogue.groupOf(item.id) ?? otherKey;
    // A group the census knows about but this page does not list is not a
    // reason to lose the count: it goes to the residual, where it is visible.
    (held.get(key) ?? held.get(otherKey)!).set(item.id, item.count);
  }

  const all: BlockSpec[] = [
    ...specs,
    { key: otherKey, label: otherLabel, roster: null },
  ];

  return all.map((spec) => {
    const counts = held.get(spec.key)!;

    const rows = spec.roster
      ? spec.roster.map((id) => ({ id, count: counts.get(id) ?? 0 }))
      : [...counts].map(([id, count]) => ({ id, count }));

    rows.sort(
      spec.roster
        ? (a, b) => catalogue.name(a.id).localeCompare(catalogue.name(b.id))
        : (a, b) => b.count - a.count || catalogue.name(a.id).localeCompare(catalogue.name(b.id)),
    );

    let count = 0;
    let value: number | null = null;
    let priced = 0;
    let counted = 0;

    for (const [id, number] of counts) {
      count += number;
      counted += 1;
      const cost = catalogue.cost(id);
      if (cost === null) continue;
      priced += 1;
      value = (value ?? 0) + number * cost;
    }

    const range = ranges?.get(spec.key) ?? null;

    return {
      key: spec.key,
      label: spec.label,
      headline: spec.headline === true,
      items: rows.slice(0, BLOCK_ROWS),
      of: rows.length,
      count,
      value,
      priced,
      counted,
      low: range?.low ?? null,
      high: range?.high ?? null,
    };
  });
}
