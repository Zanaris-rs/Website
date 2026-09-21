import { Suspense } from "react";

import type { Metadata } from "next";

import RecordsBoard from "@/components/records/RecordsBoard";
import Frame from "@/components/site/Frame";

export const metadata: Metadata = {
  title: "Records",
  description: "Zanaris records: the most XP gained in five minutes, overall and in every skill, measured by the server.",
};

export default function Records() {
  return (
    <Frame>
      {/* `useSearchParams` needs a boundary: the frame prerenders, the board
          is filled in on the client - the same split as /hiscores. */}
      <Suspense fallback={null}>
        <RecordsBoard />
      </Suspense>
    </Frame>
  );
}
