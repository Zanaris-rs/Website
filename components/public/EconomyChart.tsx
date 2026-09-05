import { chartPath, type Point } from "@/lib/public/economy";
import { formatNumber, formatShortWhen } from "@/lib/public/format";

import styles from "./Public.module.css";

/**
 * One line of the census, drawn on the server.
 *
 * It is an inline SVG and no JavaScript at all: a chart of 720 points is a
 * path attribute, the page is cached for five minutes and read once, and a
 * charting library would be a runtime dependency, a client bundle and a blank
 * box for anybody with scripting off. Nothing here computes anything either —
 * `chartPath` does the arithmetic in `lib/`, where it is tested.
 *
 * The box is 300x60 stretched to the panel's width (`preserveAspectRatio` is
 * off, and the stroke is `non-scaling-stroke` so it is not stretched with it),
 * which is why there are no numbers inside the picture: text in a stretched
 * viewBox would be stretched too. The scale is printed underneath instead, in
 * words, which is also the version a screen reader can read.
 *
 * The vertical scale is the data's own range, not zero — an hourly coin total
 * against a zero baseline is a flat line whatever it did — so the two figures
 * under the chart are not decoration, they are the axis.
 */
const COLOURS = {
  yellow: styles.yellow,
  lblue: styles.lblue,
} as const;

export default function EconomyChart({
  title,
  points,
  colour = "yellow",
  unit,
}: {
  title: string;
  points: readonly Point[];
  colour?: keyof typeof COLOURS;
  /** What the numbers are, for the label under the chart: "coins", "players". */
  unit: string;
}) {
  const width = 300;
  const height = 60;
  const chart = chartPath(points, width, height);
  const stroke = COLOURS[colour];

  return (
    <div className={styles.chart}>
      <div className={styles.chartTitle}>{title}</div>

      {chart === null ? (
        <div className={`${styles.chartCanvas} ${styles.empty}`}>
          Nothing counted yet.
        </div>
      ) : (
        <>
          <svg
            className={styles.chartCanvas}
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="none"
            role="img"
            aria-label={`${title}: ${formatNumber(chart.min)} to ${formatNumber(
              chart.max,
            )} ${unit} between ${formatShortWhen(
              chart.first.at,
            )} and ${formatShortWhen(chart.last.at)}.`}
          >
            <path className={`${styles.area} ${stroke}`} d={chart.area} />
            <path className={`${styles.line} ${stroke}`} d={chart.path} />
          </svg>
          <div className={styles.chartScale}>
            <span>
              {formatShortWhen(chart.first.at)} &middot;{" "}
              {formatNumber(chart.min)} low
            </span>
            <span>
              {formatNumber(chart.max)} high &middot;{" "}
              {formatShortWhen(chart.last.at)}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
