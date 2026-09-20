import type { Metadata } from "next";

import EconomyAbout from "@/components/public/EconomyAbout";
import { loadSpawnRecord } from "@/lib/public/read-server";

export const metadata: Metadata = {
  title: "How the economy count works",
  description:
    "What Zanaris counts every hour and what it leaves out, how items could enter the game, and what these pages cannot prove.",
};

/**
 * Five minutes, like the rest of the census.
 *
 * Mostly prose, which would be static forever, but the staff spawn log is on
 * it — that list is the evidence for the paragraphs above it, and evidence that
 * is a day stale is not evidence.
 */
export const revalidate = 300;

export default async function EconomyAboutPage() {
  return <EconomyAbout spawns={await loadSpawnRecord({ rows: true })} />;
}
