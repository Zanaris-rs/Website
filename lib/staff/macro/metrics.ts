import {
  CLICK_DELTA_MAX,
  SAMPLE_MS,
  type InputStream,
  type StreamEvent,
} from "./decode";

/**
 * What the mouse stream measures — and nothing about what it means. The
 * numbers are here; the thresholds, the families and the verdict are in
 * `verdict.ts`, so that changing one's mind about where "suspicious" starts
 * cannot quietly change what was measured.
 *
 * Every signal is a way of asking one question: **is there a person on the
 * other end of this mouse?** A person's clicks are irregular because a person
 * is not a timer; they land on slightly different pixels because a hand is not
 * a coordinate; the cursor travels to them because a mouse cannot teleport;
 * and the applet has focus, because you cannot click a window you are not
 * looking at. Each of those has an honest exception, which is why the page
 * prints all of them and a family verdict rather than a single number.
 *
 * ## Two clocks
 *
 * Click *intervals* come from the client's own click word — `delta` is 50 ms
 * samples since the previous click, measured by the browser — and not from the
 * event times, which the engine can only date to the nearest 600 ms tick. A CV
 * computed from tick-quantised times would be a measurement of the tick, not
 * of the player. Everything else uses the reconstructed times, where 50 ms is
 * the real resolution.
 */

export const MIN_CLICKS_FOR_TIMING = 30;
export const MIN_INTERVALS_FOR_RUNS = 50;
export const MIN_CLICKS_FOR_SPATIAL = 10;
export const MIN_LATENCIES = 20;
export const MIN_PATHS = 5;
export const MIN_IDLE_GAPS = 5;
export const MIN_CELL_CLICKS = 10;

/** A gap between clicks longer than this is a pause, not a rhythm. */
export const IDLE_GAP_MS = 5_000;
/** How long after a click the cursor is still worth watching for. */
export const CLICK_LOOKAHEAD_MS = 4_000;
/** How far back a click looks for a cursor to have arrived at all. */
export const CLICK_LOOKBACK_MS = 2_000;
/**
 * The last hop into a click, in pixels, beyond which the cursor did not travel
 * to the target — it was put there.
 *
 * 40 px in one 50 ms sample is 800 px/s *at the moment of arrival*. A hand
 * decelerates into a target; it does not stop dead from a flick.
 */
export const TELEPORT_JUMP_PX = 40;
/** The square a repeated click is judged inside. */
export const CELL_PX = 16;
/** A path shorter than this is not a journey and says nothing about the mouse. */
export const MIN_PATH_CHORD_PX = 20;
export const MIN_PATH_SAMPLES = 4;
/** chord/path at or above this, with little deviation, is a drawn line. */
export const STRAIGHT_RATIO = 0.98;
export const STRAIGHT_DEVIATION_PX = 2;

export type Metrics = {
  /* what there was to measure */
  readonly clicks: number;
  readonly moveSamples: number;
  /** Move samples whose position is known; the rest are pre-resync. */
  readonly placedSamples: number;
  readonly durationMs: number | null;

  /* timing */
  readonly intervals: number;
  readonly intervalCv: number | null;
  readonly intervalMeanMs: number | null;
  readonly modalIntervalMs: number | null;
  readonly modalShare: number | null;
  readonly constantRun: number | null;
  readonly idleGaps: number;
  readonly idleGapCv: number | null;

  /* spatial */
  readonly distinctPositions: number;
  readonly samePixelShare: number | null;
  readonly cellClicks: number;
  readonly cellSd: number | null;
  readonly decidableClicks: number;
  readonly teleports: number;
  readonly teleportShare: number | null;
  readonly movesPerClick: number | null;
  readonly latencies: number;
  /** Median stillness around a click, in ms. */
  readonly stillnessMs: number | null;
  readonly stillnessCv: number | null;
  readonly paths: number;
  readonly straightPaths: number;
  readonly straightShare: number | null;
  readonly pathSpeedCv: number | null;

  /* focus */
  readonly unfocusedClicks: number;
  readonly focusChanges: number;
};

type Click = Extract<StreamEvent, { type: "click" }>;
type Move = Extract<StreamEvent, { type: "move" }>;

function mean(values: readonly number[]): number {
  let total = 0;
  for (const value of values) total += value;
  return total / values.length;
}

/**
 * Coefficient of variation: the spread as a fraction of the average.
 *
 * Unitless on purpose — a script clicking every 600 ms and one clicking every
 * six seconds are equally machine-like, and a plain standard deviation would
 * call the second one ten times more variable than the first.
 */
function cv(values: readonly number[]): number | null {
  if (values.length < 2) return null;
  const average = mean(values);
  if (average === 0) return 0;
  let sum = 0;
  for (const value of values) sum += (value - average) ** 2;
  return Math.sqrt(sum / values.length) / Math.abs(average);
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function distance(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

export function measure(stream: InputStream): Metrics {
  const clicks: Click[] = [];
  const moves: Move[] = [];
  let moveSamples = 0;
  let focus = 1;
  let focusChanges = 0;
  let unfocusedClicks = 0;

  // One pass in record order, because focus is a state and only the order the
  // engine wrote them in can say what it was when a click arrived.
  for (const event of stream.events) {
    if (event.type === "focus") {
      if (event.focus !== focus) focusChanges += 1;
      focus = event.focus;
      continue;
    }
    if (event.type === "click") {
      clicks.push(event);
      if (focus === 0) unfocusedClicks += 1;
      continue;
    }
    if (event.type === "move") {
      moveSamples += 1;
      if (event.x !== null && event.y !== null && event.x >= 0 && event.y >= 0) {
        moves.push(event);
      }
    }
  }

  // Move events are dated backwards from their record's arrival, so a record
  // can begin before the one in front of it ended. Anything that reads the
  // cursor as a path has to put them in time order first.
  moves.sort((a, b) => a.at - b.at);

  /* --- timing, from the client's own click clock --- */

  const intervals: number[] = [];
  for (let i = 0; i < clicks.length; i++) {
    const delta = clicks[i].delta;
    // 0 is two clicks inside one 50 ms sample (a double click's second half);
    // 4095 is the saturation value and means "at least 205 seconds", which is
    // not a measurement.
    if (delta > 0 && delta < CLICK_DELTA_MAX) intervals.push(delta * SAMPLE_MS);
  }

  const active = intervals.filter((interval) => interval <= IDLE_GAP_MS);
  const gaps = intervals.filter((interval) => interval > IDLE_GAP_MS);

  const counts = new Map<number, number>();
  for (const interval of active) {
    counts.set(interval, (counts.get(interval) ?? 0) + 1);
  }
  let modalIntervalMs: number | null = null;
  let modalCount = 0;
  for (const [interval, count] of counts) {
    if (count > modalCount) {
      modalCount = count;
      modalIntervalMs = interval;
    }
  }

  // The longest run of consecutive intervals within one sample of each other.
  // A person's rhythm survives for a few clicks; a `sleep` loop's survives
  // until the script stops.
  let constantRun = 0;
  let run = active.length > 0 ? 1 : 0;
  for (let i = 1; i < active.length; i++) {
    if (Math.abs(active[i] - active[i - 1]) <= SAMPLE_MS) {
      run += 1;
    } else {
      constantRun = Math.max(constantRun, run);
      run = 1;
    }
  }
  constantRun = Math.max(constantRun, run);

  /* --- spatial --- */

  const positions = new Set<string>();
  for (const click of clicks) positions.add(`${click.x},${click.y}`);

  // The busiest 16-pixel square, and how tightly the clicks inside it cluster.
  // A person clicking the same bank booth two hundred times hits a spread of
  // pixels; a script clicks one.
  const cells = new Map<string, Click[]>();
  for (const click of clicks) {
    const key = `${Math.floor(click.x / CELL_PX)},${Math.floor(click.y / CELL_PX)}`;
    const cell = cells.get(key);
    if (cell) cell.push(click);
    else cells.set(key, [click]);
  }
  let busiest: Click[] = [];
  for (const cell of cells.values()) {
    if (cell.length > busiest.length) busiest = cell;
  }
  let cellSd: number | null = null;
  if (busiest.length >= MIN_CELL_CLICKS) {
    const cx = mean(busiest.map((click) => click.x));
    const cy = mean(busiest.map((click) => click.y));
    cellSd = Math.sqrt(
      mean(busiest.map((click) => (click.x - cx) ** 2 + (click.y - cy) ** 2)),
    );
  }

  // How the cursor arrived, and how long it stayed still around the click.
  //
  // Both of these have to be defined around one property of the client: it
  // flushes the move packet *on the click*, and a run of samples in which the
  // cursor did not move writes no step at all — it becomes the `delta` of the
  // next step, which is in the next packet. So the last movement before a
  // click is always dated at the click, whatever the player did in between,
  // and "time since the cursor last moved" is not a measurable quantity.
  //
  // What is measurable is the *shape* of the arrival — the length of the last
  // hop, which no clock touches — and the stillness *around* the click, which
  // arrives late but arrives whole: the samples the cursor spent still before
  // and after a click are all counted into the next record's leading delta.
  let decidableClicks = 0;
  let teleports = 0;
  const latencies: number[] = [];
  let cursor = 0;

  for (const click of clicks) {
    while (cursor < moves.length && moves[cursor].at <= click.at) cursor += 1;

    const arrival = cursor > 0 ? moves[cursor - 1] : null;
    const before = cursor > 1 ? moves[cursor - 2] : null;
    const next = cursor < moves.length ? moves[cursor] : null;

    if (
      arrival &&
      before &&
      click.at - arrival.at <= CLICK_LOOKBACK_MS &&
      arrival.at - before.at <= CLICK_LOOKBACK_MS
    ) {
      decidableClicks += 1;
      const hop = distance(
        before.x as number,
        before.y as number,
        arrival.x as number,
        arrival.y as number,
      );
      if (hop > TELEPORT_JUMP_PX) teleports += 1;
    }

    if (next) {
      const still = next.at - click.at;
      if (still >= 0 && still <= CLICK_LOOKAHEAD_MS) latencies.push(still);
    }
  }

  /* --- the cursor's path between clicks --- */

  // Both ends of the leg walk forward and never back, the way the teleport
  // loop's cursor does, because both arrays are already in time order and the
  // legs are consecutive. Filtering the whole move array once per click reads
  // better and is quadratic: on a ten-minute capture of a fast script — the
  // size the ring is allowed to reach — that is seconds of a moderator's page,
  // spent re-scanning samples the previous click already walked past.
  let paths = 0;
  let straightPaths = 0;
  const speedCvs: number[] = [];
  let legStart = 0;
  let legEnd = 0;

  for (let i = 1; i < clicks.length; i++) {
    const from = clicks[i - 1].at;
    const to = clicks[i].at;

    while (legStart < moves.length && moves[legStart].at < from) legStart += 1;
    if (legEnd < legStart) legEnd = legStart;
    while (legEnd < moves.length && moves[legEnd].at <= to) legEnd += 1;

    const legLength = legEnd - legStart;
    if (legLength < MIN_PATH_SAMPLES) continue;

    const leg = moves.slice(legStart, legEnd);
    const first = leg[0];
    const last = leg[leg.length - 1];
    const chord = distance(
      first.x as number,
      first.y as number,
      last.x as number,
      last.y as number,
    );
    if (chord < MIN_PATH_CHORD_PX) continue;

    let length = 0;
    const steps: number[] = [];
    for (let k = 1; k < leg.length; k++) {
      const step = distance(
        leg[k - 1].x as number,
        leg[k - 1].y as number,
        leg[k].x as number,
        leg[k].y as number,
      );
      steps.push(step);
      length += step;
    }
    if (length === 0) continue;

    // The furthest any sample strayed from the straight line between the ends.
    let deviation = 0;
    const dx = (last.x as number) - (first.x as number);
    const dy = (last.y as number) - (first.y as number);
    for (const move of leg) {
      const off =
        Math.abs(
          dx * ((first.y as number) - (move.y as number)) -
            ((first.x as number) - (move.x as number)) * dy,
        ) / chord;
      deviation = Math.max(deviation, off);
    }

    paths += 1;
    if (chord / length >= STRAIGHT_RATIO && deviation <= STRAIGHT_DEVIATION_PX) {
      straightPaths += 1;
    }
    const speed = cv(steps);
    if (speed !== null) speedCvs.push(speed);
  }

  const placedSamples = moves.length;

  return {
    clicks: clicks.length,
    moveSamples,
    placedSamples,
    durationMs:
      stream.from === null || stream.to === null ? null : stream.to - stream.from,

    intervals: active.length,
    intervalCv: active.length >= MIN_CLICKS_FOR_TIMING ? cv(active) : null,
    intervalMeanMs: active.length > 0 ? mean(active) : null,
    modalIntervalMs,
    modalShare:
      active.length >= MIN_CLICKS_FOR_TIMING ? modalCount / active.length : null,
    constantRun: active.length >= MIN_INTERVALS_FOR_RUNS ? constantRun : null,
    idleGaps: gaps.length,
    idleGapCv: gaps.length >= MIN_IDLE_GAPS ? cv(gaps) : null,

    distinctPositions: positions.size,
    samePixelShare:
      clicks.length >= MIN_CLICKS_FOR_SPATIAL
        ? 1 - positions.size / clicks.length
        : null,
    cellClicks: busiest.length,
    cellSd,
    decidableClicks,
    teleports,
    teleportShare:
      decidableClicks >= MIN_CLICKS_FOR_SPATIAL
        ? teleports / decidableClicks
        : null,
    movesPerClick:
      clicks.length >= MIN_CLICKS_FOR_SPATIAL ? moveSamples / clicks.length : null,
    latencies: latencies.length,
    stillnessMs: latencies.length >= MIN_LATENCIES ? median(latencies) : null,
    stillnessCv: latencies.length >= MIN_LATENCIES ? cv(latencies) : null,
    paths,
    straightPaths,
    straightShare: paths >= MIN_PATHS ? straightPaths / paths : null,
    pathSpeedCv: paths >= MIN_PATHS ? median(speedCvs) : null,

    unfocusedClicks,
    focusChanges,
  };
}
