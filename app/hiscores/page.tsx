import { Suspense } from "react";

import type { Metadata } from "next";

import HiscoresTable from "@/components/hiscores/HiscoresTable";
import Frame from "@/components/site/Frame";

export const metadata: Metadata = {
  title: "Hiscores | Zanaris",
  description: "Zanaris hiscores: rankings for Overall and every skill.",
};

export default function Hiscores() {
  return (
    <Frame>
      {/* `useSearchParams` needs a boundary: the frame prerenders, the table
          is filled in on the client. */}
      <Suspense fallback={null}>
        <HiscoresTable />
      </Suspense>
    </Frame>
  );
}
