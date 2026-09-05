import { Cinzel_Decorative } from "next/font/google";

import { SITE_NAME } from "@/lib/site";

import styles from "./Wordmark.module.css";

/**
 * The face is self-hosted by `next/font` at build time: the browser fetches it
 * from this origin and nothing is requested from Google at runtime. Black
 * weight only; the wordmark is the one thing set in it.
 */
const cinzel = Cinzel_Decorative({
  weight: "900",
  subsets: ["latin"],
  display: "swap",
});

/**
 * The site's name at the top of the title screen, as engraved silver. The
 * hidden copy underneath is the bevel; the visible one carries the text.
 */
export default function Wordmark() {
  return (
    <h1 className={`${styles.wordmark} ${cinzel.className}`}>
      <span className={styles.base} aria-hidden="true">
        {SITE_NAME}
      </span>
      <span className={styles.face}>{SITE_NAME}</span>
    </h1>
  );
}
