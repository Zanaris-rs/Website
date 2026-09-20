"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import styles from "./Public.module.css";

/**
 * The hover readout on the census charts.
 *
 * The charts are drawn on the server and stay drawn on the server: this adds a
 * crosshair over the top and nothing else. With scripting off — or before this
 * hydrates — the SVG, its `aria-label` and the scale printed underneath are all
 * exactly as they were, which is why the enhancement is allowed to exist at
 * all on a page whose job is to be readable by anybody.
 *
 * **Everything is HTML over the SVG, never inside it.** The chart's viewBox is
 * 300x60 with `preserveAspectRatio="none"`, so x is stretched by about three at
 * the frame's full width while y is not: a `<circle>` drawn in there would come
 * out an ellipse and `<text>` would come out illegible. The dot's y is the
 * server's own `chartPath` arithmetic handed back down, so the dot sits on the
 * vertex that was drawn rather than on one this file worked out again and
 * could disagree about.
 *
 * Both charts share one index through this context, so hovering either names
 * the same hour in both. That only means anything because `alignedSeries`
 * guarantees they are the same length and the same instants — without it,
 * index 40 would be a different hour in each.
 */
type Crosshair = {
  readonly at: number | null;
  readonly set: (index: number | null) => void;
};

const CrosshairContext = createContext<Crosshair>({ at: null, set: () => {} });

export function CrosshairProvider({ children }: { children: ReactNode }) {
  const [at, setAt] = useState<number | null>(null);
  const value = useMemo(() => ({ at, set: setAt }), [at]);
  return (
    <CrosshairContext.Provider value={value}>
      {children}
    </CrosshairContext.Provider>
  );
}

export type Reading = {
  /** Where the server drew this point, in the 0..height of the viewBox. */
  readonly y: number;
  readonly label: string;
  readonly when: string;
};

/**
 * The hover layer for one chart.
 *
 * `children` is the server-rendered chart, passed straight through: a server
 * component as the child of a client one, so nothing about drawing the line
 * moves into the browser.
 */
export default function ChartCrosshair({
  readings,
  height,
  children,
}: {
  readings: readonly Reading[];
  /** The viewBox height, which is also the element's height in CSS pixels. */
  height: number;
  children: ReactNode;
}) {
  const { at, set } = useContext(CrosshairContext);
  const box = useRef<HTMLDivElement | null>(null);

  const track = useCallback(
    (clientX: number) => {
      const rect = box.current?.getBoundingClientRect();
      if (!rect || rect.width === 0 || readings.length === 0) return;
      // The canvas has a 1px border and the points are drawn inside it, so the
      // usable width is two pixels narrower than the element. Without this
      // every readout drifts by a few points towards the right-hand end.
      const inner = rect.width - 2;
      const x = Math.min(Math.max(clientX - rect.left - 1, 0), inner);
      set(Math.round((x / inner) * (readings.length - 1)));
    },
    [readings.length, set],
  );

  const index = at === null ? null : Math.min(at, readings.length - 1);
  const reading = index === null ? null : readings[index];
  // A single reading has no width to divide by; it is drawn down the middle,
  // which is where `chartPath` puts it too.
  const left =
    index === null || readings.length <= 1
      ? 50
      : (index / (readings.length - 1)) * 100;

  return (
    <div
      ref={box}
      className={styles.chartHover}
      onPointerMove={(event) => track(event.clientX)}
      onPointerDown={(event) => track(event.clientX)}
      onPointerLeave={(event) => {
        // A touch that has been lifted should leave its readout on screen:
        // there is no cursor to move away, and clearing it the moment the
        // finger goes means a phone can never read one.
        if (event.pointerType !== "touch") set(null);
      }}
    >
      {children}
      {reading === null ? null : (
        <>
          <div className={styles.crosshair} style={{ left: `${left}%` }} />
          <div
            className={styles.crosshairDot}
            style={{ left: `${left}%`, top: `${(reading.y / height) * 100}%` }}
          />
          <div
            className={`${styles.readout} ${left > 55 ? styles.readoutLeft : ""}`}
            style={{ left: `${left}%` }}
          >
            <b>{reading.label}</b>
            <br />
            {reading.when}
          </div>
        </>
      )}
    </div>
  );
}
