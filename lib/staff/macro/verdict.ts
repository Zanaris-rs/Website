import type { InputStream } from "./decode";
import {
  MIN_CLICKS_FOR_SPATIAL,
  MIN_CLICKS_FOR_TIMING,
  MIN_INTERVALS_FOR_RUNS,
  type Metrics,
} from "./metrics";

/**
 * The judgement, and the reasoning printed beside it.
 *
 * A moderator reading this page is about to ban somebody, so the headline is
 * never a number. "17 of 24 signals" says nothing a person can act on and
 * everything a person can misread: eleven ways of noticing the same fixed
 * click interval would count eleven times. So the signals are grouped into
 * **families** — is the *timing* mechanical, is the *cursor* mechanical, was
 * anybody *looking at the window* — and the verdict asks for agreement across
 * families rather than a majority within one.
 *
 * | Verdict | When |
 * | --- | --- |
 * | Likely macro | bot-like on ≥2 timing **and** ≥1 spatial signal; or any click while the applet had no focus; or ≥3 bot-like signals across families |
 * | Review | any one bot-like signal, or three suspicious ones |
 * | Human-like | everything else |
 * | Not enough data | nothing could be measured |
 *
 * Two things hold the verdict back on purpose. A **touch-like** stream — taps
 * with nothing between them, landing all over the screen, at a human's
 * irregular pace — never exceeds Review, because a phone has no cursor to
 * measure and a macro that looked exactly like one would be indistinguishable.
 * And the spatial family is **not evaluated at all** for a Java client (whose
 * packets carry at most one move record each) or a throttled tab (whose mouse
 * sampler is not running at 50 ms), because a signal computed from samples
 * that were never taken is not evidence — it is an artefact, and it would
 * always point the same way.
 *
 * Every signal carries the false positive that makes it a signal rather than a
 * proof: real players do repeat themselves, and the honest version of this
 * page says so next to the number.
 */

export type Level = "bot-like" | "suspicious" | "human-like" | "insufficient";
export type Family = "timing" | "spatial" | "focus";
export type Verdict = "macro" | "review" | "human" | "insufficient";

/* --- where each signal changes its mind --- */

export const THRESHOLDS = {
  /** Clicks spaced to the millisecond. A person's rhythm wanders. */
  intervalCv: { bot: 0.08, suspicious: 0.2 },
  /** One interval accounting for most of the session. */
  modalShare: { bot: 0.6, suspicious: 0.35 },
  /** Consecutive intervals inside one 50 ms sample of each other. */
  constantRun: { bot: 20, suspicious: 10 },
  /** Even the pauses on a timer. */
  idleGapCv: { bot: 0.1, suspicious: 0.25 },
  /** Clicks landing on a pixel another click already used. */
  samePixelShare: { bot: 0.8, suspicious: 0.5 },
  /** The spread, in pixels, of the clicks inside the busiest 16 px square. */
  cellSd: { bot: 0.75, suspicious: 2 },
  /** Clicks with no cursor arriving first. */
  teleportShare: { bot: 0.5, suspicious: 0.2 },
  /** Cursor samples per click. A mouse in a hand is never still for long. */
  movesPerClick: { bot: 2, suspicious: 6 },
  /** The cursor still for the same length of time around every click. */
  stillnessCv: { bot: 0.1, suspicious: 0.25 },
  /** Journeys that are a drawn line rather than a hand's arc. */
  straightShare: { bot: 0.6, suspicious: 0.3 },
} as const;

/** Below this many cursor samples per click, with clicks spread around the
 *  screen and a human's timing, the stream looks like a finger, not a mouse. */
export const TOUCH_MOVES_PER_CLICK = 1.5;
export const TOUCH_MAX_SAME_PIXEL = 0.2;

export type Signal = {
  readonly key: string;
  readonly label: string;
  readonly family: Family;
  readonly level: Level;
  /** The measurement, as the table prints it. */
  readonly value: string;
  /** What it is asking. */
  readonly detail: string;
  /** Why an honest player can set it off. */
  readonly falsePositive: string;
  /** False when the signal was measured but kept out of the verdict. */
  readonly counted: boolean;
};

export type FamilyTally = {
  readonly family: Family;
  readonly evaluated: boolean;
  readonly botLike: number;
  readonly suspicious: number;
  readonly measured: number;
};

export type Adjudication = {
  readonly verdict: Verdict;
  /** "Likely macro", and nothing about counts. */
  readonly headline: string;
  /** One sentence saying which families agreed. */
  readonly reason: string;
  readonly signals: readonly Signal[];
  readonly families: readonly FamilyTally[];
  readonly touchLike: boolean;
  /** Why the spatial family was left out, when it was. */
  readonly spatialWithheld: "java client" | "throttled tab" | null;
};

export const VERDICT_HEADLINES: Record<Verdict, string> = {
  macro: "Likely macro",
  review: "Review",
  human: "Human-like",
  insufficient: "Not enough data",
};

/* --- formatting --- */

function ratio(value: number | null): string {
  return value === null ? "—" : value.toFixed(2);
}

function percent(value: number | null): string {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

function pixels(value: number | null): string {
  return value === null ? "—" : `${value.toFixed(1)} px`;
}

function count(value: number | null): string {
  return value === null ? "—" : `${value}`;
}

/** "1 click", "2 clicks": a table that says "1 clicks" reads as a machine wrote it. */
function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** A signal reads high when a big number is the machine-like one. */
function levelHigh(
  value: number | null,
  bounds: { bot: number; suspicious: number },
): Level {
  if (value === null) return "insufficient";
  if (value >= bounds.bot) return "bot-like";
  if (value >= bounds.suspicious) return "suspicious";
  return "human-like";
}

/** ...and low when a small one is. */
function levelLow(
  value: number | null,
  bounds: { bot: number; suspicious: number },
): Level {
  if (value === null) return "insufficient";
  if (value <= bounds.bot) return "bot-like";
  if (value <= bounds.suspicious) return "suspicious";
  return "human-like";
}

export function adjudicate(
  metrics: Metrics,
  stream: InputStream,
): Adjudication {
  const flags = new Set(stream.flags);
  const spatialWithheld = flags.has("java-client")
    ? ("java client" as const)
    : flags.has("throttled")
      ? ("throttled tab" as const)
      : null;

  const timing: Signal[] = [
    {
      key: "intervalCv",
      label: "Click interval spread",
      family: "timing",
      level: levelLow(metrics.intervalCv, THRESHOLDS.intervalCv),
      value: ratio(metrics.intervalCv),
      detail: `How much the time between clicks varies, as a fraction of the average. Needs ${MIN_CLICKS_FOR_TIMING} intervals.`,
      falsePositive:
        "A player doing one repetitive thing — fishing, alching, an agility lap — clicks in a real rhythm. What a hand cannot do is hold that rhythm to the sample for hundreds of clicks.",
      counted: true,
    },
    {
      key: "modalShare",
      label: "Commonest interval",
      family: "timing",
      level: levelHigh(metrics.modalShare, THRESHOLDS.modalShare),
      value: percent(metrics.modalShare),
      detail:
        metrics.modalIntervalMs === null
          ? "The share of intervals sitting on one exact value."
          : `The share of intervals sitting on exactly ${metrics.modalIntervalMs} ms.`,
      falsePositive:
        "Actions paced by the game's own 600 ms tick genuinely pile onto one interval, and a player waiting for an animation is pacing off the server, not off a clock of their own.",
      counted: true,
    },
    {
      key: "constantRun",
      label: "Longest unbroken rhythm",
      family: "timing",
      level: levelHigh(metrics.constantRun, THRESHOLDS.constantRun),
      value: count(metrics.constantRun),
      detail: `Consecutive intervals within one 50 ms sample of each other. Needs ${MIN_INTERVALS_FOR_RUNS} intervals.`,
      falsePositive:
        "A run of a dozen is ordinary in a repetitive task; it is the run that never breaks — through a chat message, a dropped item, somebody walking past — that no person produces.",
      counted: true,
    },
    {
      key: "idleGapCv",
      label: "Break regularity",
      family: "timing",
      level: levelLow(metrics.idleGapCv, THRESHOLDS.idleGapCv),
      value: ratio(metrics.idleGapCv),
      detail: `Spread of the gaps longer than five seconds. ${plural(metrics.idleGaps, "gap")} in this capture.`,
      falsePositive:
        "A player who pauses for the same reason every time — a bank run, a respawn, a kiln — pauses regularly. Breaks that are identical *and* clicks that are identical is the pair that matters.",
      counted: true,
    },
  ];

  const spatial: Signal[] = [
    {
      key: "samePixelShare",
      label: "Repeated pixels",
      family: "spatial",
      level: levelHigh(metrics.samePixelShare, THRESHOLDS.samePixelShare),
      value: percent(metrics.samePixelShare),
      detail: `Clicks landing on a pixel another click already used. ${plural(metrics.distinctPositions, "distinct position")} in ${plural(metrics.clicks, "click")}.`,
      falsePositive:
        "A fixed interface target — the bank's Deposit button, a spell in the book — is honestly the same pixel every time, and a player who never moves the game window will hit it again and again.",
      counted: spatialWithheld === null,
    },
    {
      key: "cellSd",
      label: "Spread inside the busiest square",
      family: "spatial",
      level: levelLow(metrics.cellSd, THRESHOLDS.cellSd),
      value: pixels(metrics.cellSd),
      detail: `How far the clicks inside the most-used 16 px square sit from its centre. ${plural(metrics.cellClicks, "click")} in it.`,
      falsePositive:
        "A small target leaves a person little room to vary, and a steady hand on a trackball is genuinely tight. Zero is the number no hand produces.",
      counted: spatialWithheld === null,
    },
    {
      key: "teleportShare",
      label: "Clicks with no approach",
      family: "spatial",
      level: levelHigh(metrics.teleportShare, THRESHOLDS.teleportShare),
      value: percent(metrics.teleportShare),
      detail: `Clicks the cursor reached in one hop of more than 40 pixels rather than by travelling. ${metrics.teleports} of ${metrics.decidableClicks} judgeable.`,
      falsePositive:
        "A fast flick across the screen ends in a long sample, and a capture that lost move packets (marker 1, printed above) leaves real journeys looking like jumps. A hand decelerates into a target; the giveaway is arrival at full speed, every time.",
      counted: spatialWithheld === null,
    },
    {
      key: "movesPerClick",
      label: "Cursor samples per click",
      family: "spatial",
      level: levelLow(metrics.movesPerClick, THRESHOLDS.movesPerClick),
      value: ratio(metrics.movesPerClick),
      detail: `How much the mouse moved between clicks. ${plural(metrics.moveSamples, "sample")} in ${plural(metrics.clicks, "click")}.`,
      falsePositive:
        "A touchscreen has no cursor between taps at all, and a player clicking one spot over and over genuinely does not move the mouse. This is the signal the touch cap exists for.",
      counted: spatialWithheld === null,
    },
    {
      key: "stillnessCv",
      label: "Stillness around a click",
      family: "spatial",
      level: levelLow(metrics.stillnessCv, THRESHOLDS.stillnessCv),
      value: ratio(metrics.stillnessCv),
      detail:
        metrics.stillnessMs === null
          ? "Spread of how long the cursor sat still on either side of a click."
          : `Spread of how long the cursor sat still on either side of a click; the middle one is ${Math.round(metrics.stillnessMs)} ms. The client flushes its move packet on the click, so the pause before and the pause after arrive together.`,
      falsePositive:
        "Muscle memory on one target produces a fairly constant pause. It does not produce the same pause, sample for sample, on targets at different distances.",
      counted: spatialWithheld === null,
    },
    {
      key: "straightShare",
      label: "Straight-line journeys",
      family: "spatial",
      level: levelHigh(metrics.straightShare, THRESHOLDS.straightShare),
      value: percent(metrics.straightShare),
      detail: `Journeys between clicks whose path is the chord, within two pixels. ${metrics.straightPaths} of ${metrics.paths} long enough to judge.`,
      falsePositive:
        "A mouse dragged along a screen edge travels in a straight line honestly, and so does a very short hop — which is why journeys under twenty pixels are not counted at all.",
      counted: spatialWithheld === null,
    },
  ];

  const focus: Signal[] = [
    {
      key: "unfocusedClicks",
      label: "Clicks with the window unfocused",
      family: "focus",
      // An unfocused click convicts on its own, so it is never held back for
      // want of a sample size. The *absence* of one is only worth saying when
      // there were clicks to be unfocused during: "nobody clicked a window
      // nobody was looking at" is not evidence when nobody clicked at all.
      level:
        metrics.unfocusedClicks > 0
          ? "bot-like"
          : metrics.clicks >= MIN_CLICKS_FOR_SPATIAL
            ? "human-like"
            : "insufficient",
      value: count(metrics.unfocusedClicks),
      detail: `Clicks the client reported while the applet did not have focus. ${plural(metrics.focusChanges, "focus change")} in the capture.`,
      falsePositive:
        "The applet reports its own focus, not the desktop's: a notification that steals focus and gives it back can land one click on the wrong side of the line. One is a coincidence. A session of them is a program clicking a window nobody is looking at.",
      counted: true,
    },
  ];

  const signals = [...timing, ...spatial, ...focus];

  const tally = (family: Family, evaluated: boolean): FamilyTally => {
    const mine = signals.filter((signal) => signal.family === family);
    return {
      family,
      evaluated,
      botLike: evaluated
        ? mine.filter((signal) => signal.level === "bot-like").length
        : 0,
      suspicious: evaluated
        ? mine.filter((signal) => signal.level === "suspicious").length
        : 0,
      measured: mine.filter((signal) => signal.level !== "insufficient").length,
    };
  };

  const families: FamilyTally[] = [
    tally("timing", true),
    tally("spatial", spatialWithheld === null),
    tally("focus", true),
  ];

  const timingTally = families[0];
  const spatialTally = families[1];
  const focusTally = families[2];

  const botLike =
    timingTally.botLike + spatialTally.botLike + focusTally.botLike;
  const suspicious =
    timingTally.suspicious + spatialTally.suspicious + focusTally.suspicious;
  const measured = families.reduce(
    (total, family) => total + (family.evaluated ? family.measured : 0),
    0,
  );

  /**
   * A finger, not a mouse: taps with nothing between them, spread around the
   * screen, at a person's uneven pace.
   *
   * The last two conditions are what keep it from being a way out. A script
   * that clicks one pixel is not touch-like however little the cursor moves,
   * and neither is one whose timing is mechanical — and a stream with clicks
   * while the window was unfocused is not a phone at all, because you cannot
   * tap a window that is not in front of you.
   */
  const touchLike =
    spatialWithheld === null &&
    metrics.movesPerClick !== null &&
    metrics.movesPerClick < TOUCH_MOVES_PER_CLICK &&
    (metrics.samePixelShare ?? 0) < TOUCH_MAX_SAME_PIXEL &&
    timingTally.botLike === 0 &&
    metrics.unfocusedClicks === 0;

  let verdict: Verdict;
  let reason: string;

  if (measured === 0) {
    verdict = "insufficient";
    reason =
      "Nothing in this capture could be measured: too few clicks, or no input at all. That is a verdict, not a pass — it means look at the chat and the wealth events instead.";
  } else if (focusTally.botLike > 0) {
    verdict = "macro";
    reason = `${metrics.unfocusedClicks} click${metrics.unfocusedClicks === 1 ? "" : "s"} arrived while the applet did not have focus. A person cannot click a window they are not looking at.`;
  } else if (timingTally.botLike >= 2 && spatialTally.botLike >= 1) {
    verdict = "macro";
    reason = `The timing is mechanical on ${timingTally.botLike} signals and the cursor on ${spatialTally.botLike}. Two families agreeing is what separates a macro from a player in a rhythm.`;
  } else if (botLike >= 3) {
    verdict = "macro";
    reason = `Bot-like on ${botLike} signals across ${families.filter((family) => family.botLike > 0).length} families.`;
  } else if (botLike >= 1) {
    verdict = "review";
    reason = `One family reads as mechanical and the others do not, which is as often a repetitive player as a script. Watch them, or capture again.`;
  } else if (suspicious >= 3) {
    verdict = "review";
    reason = `Nothing here is conclusive, but ${suspicious} signals sit between a person and a program.`;
  } else {
    verdict = "human";
    reason =
      "Nothing in the input looks mechanical. This is not proof of innocence — it is the absence of evidence for the thing that was reported.";
  }

  if (touchLike && verdict === "macro") {
    verdict = "review";
    reason = `${reason} Held at Review: the stream has no cursor between clicks, which is what a touchscreen looks like, and no cursor is no evidence.`;
  }

  return {
    verdict,
    headline: VERDICT_HEADLINES[verdict],
    reason,
    signals,
    families,
    touchLike,
    spatialWithheld,
  };
}
