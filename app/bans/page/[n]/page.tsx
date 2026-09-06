import type { Metadata } from "next";
import { notFound } from "next/navigation";

import Bans from "@/components/public/Bans";
import Frame from "@/components/site/Frame";
import Panel from "@/components/site/Panel";
import TitleBox from "@/components/site/TitleBox";
import { loadPunishments } from "@/lib/public/read-server";

export const revalidate = 300;

/**
 * Page 2 onwards of the ban record.
 *
 * Unlike `/news/page/[n]`, the pages cannot be enumerated at build time: the
 * news lives in this repo and the record lives in a database that gains a row
 * whenever a moderator acts. So there is no `generateStaticParams` and no
 * `dynamicParams = false` here — each page is rendered on demand and then
 * cached for five minutes like page 1.
 *
 * Two different kinds of "no rows" are told apart on purpose. A page number
 * past the end of the record is a 404, because it is a URL that does not name
 * anything. An *empty record* is not: `/bans` renders its own "nothing yet"
 * state, and only page 2 and up can be past the end.
 *
 * The segment has to *look* like a page number as well as parse as one.
 * `Number` accepts `2.0`, `0x2`, ` 2 ` and `2e0`, every one of which would be
 * a second URL for a page that already has one; the pattern is the canonical
 * spelling and nothing else. A digit string too long to be an exact integer
 * is a 404 too, rather than an offset Postgres cannot read.
 */
const PAGE_SEGMENT = /^[1-9]\d*$/;

function pageNumber(raw: string): number {
  if (!PAGE_SEGMENT.test(raw)) notFound();
  const n = Number(raw);
  if (!Number.isSafeInteger(n) || n < 2) notFound();
  return n;
}

export async function generateMetadata({
  params,
}: PageProps<"/bans/page/[n]">): Promise<Metadata> {
  const { n } = await params;
  return {
    title: `Bans and Mutes, page ${pageNumber(n)}`,
    description:
      "The permanent public record of every ban and mute issued on Zanaris.",
  };
}

export default async function BansPagePage({
  params,
}: PageProps<"/bans/page/[n]">) {
  const { n } = await params;
  const page = pageNumber(n);
  const load = await loadPunishments(page);

  if (load.status !== "ok") {
    return (
      <Frame>
        <TitleBox title="Bans and Mutes" />
        <Panel>
          <p>The ban record is unavailable right now. Try again shortly.</p>
        </Panel>
      </Frame>
    );
  }

  // The rows that came back, not the ones this build could read: a page past
  // the end of the record does not exist, but a page whose rows the parser
  // dropped does, and answering 404 would hide that rather than show it.
  if (load.data.rowCount === 0) notFound();

  return (
    <Frame>
      <Bans page={load.data} />
    </Frame>
  );
}
