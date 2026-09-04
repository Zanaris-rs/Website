import { Suspense } from "react";

import type { Metadata } from "next";

import PlayerHiscores from "@/components/hiscores/PlayerHiscores";
import Frame from "@/components/site/Frame";
import { toDisplayName } from "@/lib/base37";

export async function generateMetadata({
  params,
}: PageProps<"/hiscores/player/[username]">): Promise<Metadata> {
  const { username } = await params;
  // A hand-typed URL can carry a malformed escape; that is a bad name, not a
  // crashed page.
  let decoded = username;
  try {
    decoded = decodeURIComponent(username);
  } catch {}
  const name = toDisplayName(decoded);
  return {
    title: `${name} | Zanaris Hiscores`,
    description: `Zanaris hiscores for ${name}.`,
  };
}

export default async function Player({
  params,
}: PageProps<"/hiscores/player/[username]">) {
  const { username } = await params;

  return (
    <Frame>
      <Suspense fallback={null}>
        <PlayerHiscores username={username} />
      </Suspense>
    </Frame>
  );
}
