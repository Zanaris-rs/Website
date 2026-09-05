import type { Metadata } from "next";

import Disclaimer from "@/components/site/Disclaimer";
import Frame from "@/components/site/Frame";

export const metadata: Metadata = {
  // `absolute` because this page is the whole title, not a section of the
  // site: the root template would otherwise make it "… | Zanaris | Zanaris".
  title: { absolute: "Non-Affiliation Disclaimer | Zanaris" },
  description:
    "Zanaris is a free, open-source, community-run rehost of the Lost City (2004scape) server. Not affiliated with Jagex Ltd.",
  alternates: { canonical: "/" },
};

/**
 * `/` is the disclaimer, the way it is on Lost City: the first thing an
 * inbound link shows is what this project is and is not. `/disclaimer` is the
 * same page with a way back to the menu, and canonicalises here.
 */
export default function Home() {
  return (
    <Frame disclaimerLink={false}>
      <Disclaimer menuLink={false} />
    </Frame>
  );
}
