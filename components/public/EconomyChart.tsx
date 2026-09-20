import { chartPath, movingAverage, TREND_SPAN, type Point } from "@/lib/public/economy";
import { formatNumber, formatShortWhen } from "@/lib/public/format";

import ChartCrosshair, { type Reading } from "./EconomyCrosshair";
import styles from "./Public.module.css";

/**
 * One line of the census, drawn on the server — and the trend through it.
 *
 * Still an inline SVG and still no charting library: a chart of 720 points is
 * a path attribute, the page is cached for five minutes and read once, and a
 * library would be a runtime dependency and a blank box for anybody with
 * scripting off. Nothing here computes anything either — `chartPath` and
 * `movingAverage` do the arithmetic in `lib/`, where it is tested.
 *
 * It used to draw the series twice: the line, and the same path closed to the
 * baseline as a faint fill. Read quickly that was two shapes in two weights,
 * which is what a chart with two series looks like — so it invited exactly the
 * question it could not answer, because there was no second series and nothing
 * for a legend to name. There is one now. The pale line is what the census
 * counted, hour by hour, and the dashed one is the trailing twelve-hour
 * average through it, and the key underneath says so.
 *
 * Both are scaled to one range spanning both, because two lines drawn to their
 * own ranges each fill the box: a trend well below its readings would be drawn
 * straight through them and the picture would be a lie about a real thing.
 *
 * The box is 300x110 stretched to the panel's width (`preserveAspectRatio` is
 * off, and the strokes are `non-scaling-stroke` so they are not stretched into
 * wedges), which is why there are no numbers inside the picture: text in a
 * stretched viewBox would be stretched too. The scale is printed underneath
 * instead, which is also the version a screen reader can read.
 *
 * The vertical scale is the data's own range, not zero — an hourly coin total
 * against a zero baseline is a flat line whatever it did — so the two figures
 * under the chart are not decoration, they are the axis.
 */
const COLOURS = {
  yellow: styles.yellow,
  lblue: styles.lblue,
} as const;

const WIDTH = 300;
const HEIGHT = 110;

export default function EconomyChart({
  title,
  points,
  colour = "yellow",
  unit,
}: {
  title: string;
  points: readonly Point[];
  colour?: keyof typeof COLOURS;
  /** What the numbers are, **singular**: "coin", "account". */
  unit: string;
}) {
  const stroke = COLOURS[colour];
  const trendPoints = movingAverage(points);

  // One ruler for both lines. Taken over the readings and the trend together,
  // because the average of a falling series dips below its own last reading.
  const values = [
    ...points.map((point) => point.value),
    ...trendPoints.map((point) => point.value),
  ];
  const range =
    values.length === 0
      ? undefined
      : { min: Math.min(...values), max: Math.max(...values) };

  const chart = chartPath(points, WIDTH, HEIGHT, 1, range);
  const trend = chartPath(trendPoints, WIDTH, HEIGHT, 1, range);

  if (chart === null) {
    return (
      <div className={styles.chart}>
        <div className={styles.chartTitle}>{title}</div>
        <div className={`${styles.chartCanvas} ${styles.empty}`}>
          Nothing counted yet.
        </div>
      </div>
    );
  }

  // "1 accounts" is the sort of thing that makes a page look generated. The
  // unit is given singular and the reading decides, because only the reading
  // knows how many of them there are.
  const readings: Reading[] = points.map((point, index) => ({
    y: chart.ys[index],
    label: `${formatNumber(point.value)} ${point.value === 1 ? unit : `${unit}s`}`,
    when: formatShortWhen(point.at),
  }));

  return (
    <div className={styles.chart}>
      <div className={styles.chartTitle}>{title}</div>

      <ChartCrosshair readings={readings} height={HEIGHT}>
        <svg
          className={styles.chartCanvas}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={`${title}: ${formatNumber(chart.min)} to ${formatNumber(
            chart.max,
          )} ${unit}s between ${formatShortWhen(
            chart.first.at,
          )} and ${formatShortWhen(chart.last.at)}.`}
        >
          <path className={`${styles.line} ${stroke}`} d={chart.path} />
          {trend === null ? null : (
            <path className={styles.trend} d={trend.path} />
          )}
        </svg>
      </ChartCrosshair>

      <div className={styles.chartScale}>
        <span>
          {formatShortWhen(chart.first.at)} &middot; {formatNumber(chart.min)}{" "}
          low
        </span>
        <span>
          {formatNumber(chart.max)} high &middot;{" "}
          {formatShortWhen(chart.last.at)}
        </span>
      </div>

      <div className={styles.key}>
        <span>
          <span className={`${styles.keyLine} ${stroke}`} /> counted each hour
        </span>
        <span>
          <span className={`${styles.keyLine} ${styles.keyTrend}`} /> average of
          the last {TREND_SPAN} hours
        </span>
      </div>
    </div>
  );
}
