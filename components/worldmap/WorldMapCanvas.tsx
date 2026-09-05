"use client";

import { useEffect, useRef, useState } from "react";

import styles from "./WorldMap.module.css";

/**
 * The 2004 map applet, in a canvas.
 *
 * `public/js/mapview.js` is the client's own `MapView`, bundled straight from
 * the Client-TS source by `scripts/update-worldmap.sh`. It is not part of this
 * app's bundle and must not be: it reaches for `document.getElementById
 * ("canvas")` the moment it is evaluated, so the canvas has to be in the
 * document first. That is what the `useEffect` and the ignore comments buy —
 * a real runtime `import()` of a URL, after paint, rather than something the
 * bundler tries to resolve at build time.
 *
 * It is also why every link in the page chrome is a plain `<a>`: a client-side
 * navigation into this page would hand the applet a document whose canvas is
 * not there yet.
 */
export default function WorldMapCanvas() {
  const [failed, setFailed] = useState(false);
  // Strict Mode runs effects twice on the same instance in development, and
  // the applet has no teardown; the ref is never reset, so one mount starts
  // exactly one MapView.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    import(
      /* webpackIgnore: true */ /* turbopackIgnore: true */ "/js/mapview.js"
    )
      .then((module) => {
        new module.MapView();
      })
      .catch((error) => {
        console.error("[worldmap] the map applet failed to load:", error);
        setFailed(true);
      });
  }, []);

  return (
    <div className={styles.wrapper}>
      {failed ? (
        <p className={styles.failed} role="status">
          The map could not be loaded.
        </p>
      ) : null}
      <canvas
        id="canvas"
        width={635}
        height={503}
        style={{ imageRendering: "pixelated" }}
      />
    </div>
  );
}
