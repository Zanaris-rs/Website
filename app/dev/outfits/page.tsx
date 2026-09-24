import type { Metadata } from "next";
import { notFound } from "next/navigation";

import Frame from "@/components/site/Frame";
import Panel from "@/components/site/Panel";
import TitleBox from "@/components/site/TitleBox";

import DevOutfits from "./DevOutfits";

export const metadata: Metadata = {
  title: "Outfit editor",
  robots: { index: false },
};

/**
 * The outfit editor over an in-memory store, for working on it before (and
 * without) the database behind the real one. Development only — production
 * answers 404.
 */
export default function DevOutfitsPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <Frame>
      <TitleBox title="Outfit editor" />
      <Panel width="100%">
        <DevOutfits />
      </Panel>
    </Frame>
  );
}
