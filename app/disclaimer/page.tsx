import type { Metadata } from "next";

import Disclaimer from "@/components/site/Disclaimer";
import Frame from "@/components/site/Frame";

export const metadata: Metadata = {
  title: { absolute: "Non-Affiliation Disclaimer | Zanaris" },
  description:
    "Zanaris is a free, open-source, community-run rehost of the Lost City (2004scape) server. Not affiliated with Jagex Ltd.",
  // The same page as `/`, so the crawlers are told which one is the page.
  alternates: { canonical: "/" },
};

/** The footer link on every page lands here; `/` is the same thing. */
export default function DisclaimerPage() {
  return (
    <Frame disclaimerLink={false}>
      <Disclaimer menuLink />
    </Frame>
  );
}
