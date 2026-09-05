import { SCREEN_HEIGHT, SCREEN_WIDTH, type InputStream } from "@/lib/staff/macro/decode";

import styles from "./Staff.module.css";

/**
 * The capture, drawn: what the mouse did, when, and where it clicked.
 *
 * **Server-rendered SVG with no script anywhere near it.** A moderator's page
 * that needs JavaScript to show the evidence is a page that shows nothing when
 * a CSP or an extension gets in the way, and this drawing has no interaction
 * to lose — it is a picture of a stream that finished before the page was
 * asked for.
 *
 * Two panels, because the two questions are different. The timeline answers
 * *when*: a click tick per click, left button below the line and right above,
 * the density of cursor samples behind them, the spans where the applet had no
 * focus shaded out, and the report's own instant marked — everything to the
 * left of it came out of the ring the world was already keeping, everything to
 * the right is the fifteen-minute tail. The plot answers *where*: the applet's
 * own 765x503, with the cursor path faint behind the clicks, because "every
 * click on one pixel" and "clicks scattered over an inventory" are the two
 * pictures a moderator can tell apart at a glance and no number describes.
 */

const WIDTH = 700;
const HEIGHT = 132;
const PAD = 28;
const AXIS_Y = 84;
const DENSITY_TOP = 20;
const DENSITY_HEIGHT = 52;
/** How many buckets the density is drawn in. One per two pixels is plenty. */
const BUCKETS = 350;

const LEFT_CLICK = "#9db8c3";
const RIGHT_CLICK = "#ffbb22";
const DENSITY = "#04a800";
const REPORT = "#e10505";
const AXIS = "#6b6b6b";
const UNFOCUSED = "#570700";

/**
 * The axis labels. Seconds appear for a capture short enough that three marks
 * would otherwise all read as the same minute — a two-minute ring dump is
 * exactly what a report that arrived quickly looks like.
 */
function clock(at: number, withSeconds: boolean): string {
  const when = new Date(at);
  const hours = String(when.getUTCHours()).padStart(2, "0");
  const minutes = String(when.getUTCMinutes()).padStart(2, "0");
  if (!withSeconds) return `${hours}:${minutes}`;
  return `${hours}:${minutes}:${String(when.getUTCSeconds()).padStart(2, "0")}`;
}

export default function InputTimeline({
  stream,
  reportAt,
}: {
  stream: InputStream;
  /** Epoch ms of the report itself, when it is inside the capture. */
  reportAt: number | null;
}) {
  const from = stream.from;
  const to = stream.to;

  if (from === null || to === null || to <= from) {
    return (
      <p className={styles.empty}>
        There is no input in this capture to draw.
      </p>
    );
  }

  const span = to - from;
  const seconds = span < 10 * 60_000;
  const x = (at: number) =>
    PAD + ((at - from) / span) * (WIDTH - PAD * 2);

  /* --- what to draw --- */

  const density = new Array<number>(BUCKETS).fill(0);
  const clicks: { at: number; button: number; x: number; y: number }[] = [];
  const path: { x: number; y: number }[] = [];
  const unfocused: { from: number; to: number }[] = [];

  let focus = 1;
  let lostAt: number | null = null;

  for (const event of stream.events) {
    if (event.type === "move") {
      const bucket = Math.min(
        BUCKETS - 1,
        Math.max(0, Math.floor(((event.at - from) / span) * BUCKETS)),
      );
      density[bucket] += 1;
      if (event.x !== null && event.y !== null && event.x >= 0 && event.y >= 0) {
        path.push({ x: event.x, y: event.y });
      }
      continue;
    }
    if (event.type === "click") {
      clicks.push({ at: event.at, button: event.button, x: event.x, y: event.y });
      continue;
    }
    if (event.type === "focus") {
      if (event.focus === 0 && focus === 1) lostAt = event.at;
      if (event.focus === 1 && focus === 0 && lostAt !== null) {
        unfocused.push({ from: lostAt, to: event.at });
        lostAt = null;
      }
      focus = event.focus;
    }
  }
  if (lostAt !== null) unfocused.push({ from: lostAt, to });

  const busiest = Math.max(1, ...density);

  // The density as one filled shape rather than 350 rectangles: a path is a
  // fraction of the markup and draws the same thing.
  let area = `M ${PAD} ${DENSITY_TOP + DENSITY_HEIGHT}`;
  for (let i = 0; i < BUCKETS; i++) {
    const bx = PAD + (i / BUCKETS) * (WIDTH - PAD * 2);
    const by =
      DENSITY_TOP + DENSITY_HEIGHT - (density[i] / busiest) * DENSITY_HEIGHT;
    area += ` L ${bx.toFixed(1)} ${by.toFixed(1)}`;
  }
  area += ` L ${WIDTH - PAD} ${DENSITY_TOP + DENSITY_HEIGHT} Z`;

  const trail =
    path.length < 2
      ? null
      : path
          .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
          .join(" ");

  const middle = from + span / 2;

  return (
    <>
      <svg
        className={styles.timeline}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={`Input timeline: ${clicks.length} clicks between ${clock(from, seconds)} and ${clock(to, seconds)} UTC`}
      >
        {unfocused.map((span_, index) => (
          <rect
            key={`unfocused-${index}`}
            x={x(span_.from)}
            y={DENSITY_TOP - 8}
            width={Math.max(1, x(span_.to) - x(span_.from))}
            height={AXIS_Y - DENSITY_TOP + 24}
            fill={UNFOCUSED}
          />
        ))}

        <path d={area} fill={DENSITY} fillOpacity={0.45} />

        <line
          x1={PAD}
          y1={AXIS_Y}
          x2={WIDTH - PAD}
          y2={AXIS_Y}
          stroke={AXIS}
          strokeWidth={1}
        />

        {clicks.map((click, index) => (
          <line
            key={`click-${index}`}
            x1={x(click.at)}
            y1={click.button === 1 ? AXIS_Y - 10 : AXIS_Y}
            x2={x(click.at)}
            y2={click.button === 1 ? AXIS_Y : AXIS_Y + 10}
            stroke={click.button === 1 ? RIGHT_CLICK : LEFT_CLICK}
            strokeWidth={1}
          />
        ))}

        {reportAt !== null && reportAt >= from && reportAt <= to ? (
          <>
            <line
              x1={x(reportAt)}
              y1={8}
              x2={x(reportAt)}
              y2={AXIS_Y + 14}
              stroke={REPORT}
              strokeWidth={1}
            />
            <text
              x={x(reportAt) + 3}
              y={14}
              fill={REPORT}
              fontSize={9}
              fontFamily="Helvetica, Arial, sans-serif"
            >
              reported
            </text>
          </>
        ) : null}

        {[
          { at: from, anchor: "start" as const, dx: 0 },
          { at: middle, anchor: "middle" as const, dx: 0 },
          { at: to, anchor: "end" as const, dx: 0 },
        ].map((mark) => (
          <text
            key={`axis-${mark.at}`}
            x={x(mark.at) + mark.dx}
            y={AXIS_Y + 24}
            fill={AXIS}
            fontSize={9}
            textAnchor={mark.anchor}
            fontFamily="Helvetica, Arial, sans-serif"
          >
            {clock(mark.at, seconds)}
          </text>
        ))}

        <text
          x={PAD}
          y={HEIGHT - 4}
          fill={AXIS}
          fontSize={9}
          fontFamily="Helvetica, Arial, sans-serif"
        >
          cursor samples above · left clicks below the line, right clicks above
          · UTC
        </text>
      </svg>

      <svg
        className={styles.plot}
        viewBox={`0 0 ${SCREEN_WIDTH} ${SCREEN_HEIGHT}`}
        role="img"
        aria-label={`Where the ${clicks.length} clicks landed in the ${SCREEN_WIDTH} by ${SCREEN_HEIGHT} applet`}
      >
        <rect
          x={0.5}
          y={0.5}
          width={SCREEN_WIDTH - 1}
          height={SCREEN_HEIGHT - 1}
          fill="none"
          stroke={AXIS}
          strokeWidth={1}
        />
        {trail === null ? null : (
          <path
            d={trail}
            fill="none"
            stroke={DENSITY}
            strokeOpacity={0.5}
            strokeWidth={1}
          />
        )}
        {clicks.map((click, index) => (
          <circle
            key={`plot-${index}`}
            cx={click.x}
            cy={click.y}
            r={3}
            fill="none"
            stroke={click.button === 1 ? RIGHT_CLICK : LEFT_CLICK}
            strokeWidth={1}
          />
        ))}
      </svg>
    </>
  );
}
