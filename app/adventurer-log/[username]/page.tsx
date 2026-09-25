import type { Metadata } from "next";
import { notFound } from "next/navigation";

import LogView from "@/components/adventurer-log/LogView";
import ReportButton from "@/components/adventurer-log/ReportButton";
import Frame from "@/components/site/Frame";
import Panel from "@/components/site/Panel";
import TitleBox from "@/components/site/TitleBox";
import { readSession } from "@/lib/account/session-server";
import { sanitizeCss } from "@/lib/adventurer-log/css";
import { nameFrom } from "@/lib/adventurer-log/name";
import { loadLogPage, type LogPageData } from "@/lib/adventurer-log/page-data";
import { toDisplayName } from "@/lib/base37";

export const dynamic = "force-dynamic";

type Params = {
  params: Promise<{ username: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * The title and the link preview's text, from the name alone: this runs
 * alongside the page, so reading the log here would be a second trip to the
 * database on every view. The preview's picture (`opengraph-image.tsx`, which
 * Next adds as `og:image` itself) is where the log is read — it is fetched
 * by a chat app or a crawler, not by every reader — and it carries the
 * headline, so the description does not need it.
 */
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const name = nameFrom((await params).username);
  if (!name) return { title: "Adventurer Log" };
  const display = toDisplayName(name);
  const title = `${display}'s Adventurer Log`;
  const description = `${display}'s adventures, updates and outfits on Zanaris.`;
  return {
    title,
    description,
    openGraph: { title, description, type: "profile" },
    twitter: { card: "summary_large_image" },
  };
}

/**
 * `/adventurer-log/<name>` — a player's public page. Anyone can read it;
 * what the viewer may do on it is decided by the database from the signed
 * session's name (the header's `is_owner`, `viewer_can_post`).
 * `?show=<filter>` narrows the timeline to one kind of entry (`filters.ts`).
 */
export default async function AdventurerLog({ params, searchParams }: Params) {
  const username = nameFrom((await params).username);
  if (!username) notFound();
  const show = (await searchParams).show;

  const session = await readSession();
  const viewer = session?.u ?? null;

  let data: LogPageData;
  try {
    data = await loadLogPage(username, viewer, typeof show === "string" ? show : null);
  } catch (error) {
    console.error("[adventurer-log] page read failed", error);
    return <Unavailable text="Adventurer Logs are unavailable right now. Try again shortly." />;
  }

  if (data.result === "banned") {
    return <Unavailable text="This Adventurer Log is not available." />;
  }
  if (data.result !== "ok") return notFound();

  // The owner's stylesheet, unless staff turned it off. It is the owner's
  // page, so there is no reader's switch to leave it out. Sanitised on every
  // render, so a stricter sanitiser applies to every log at once.
  const styled = data.header.customCss.trim() !== "" && !data.header.cssDisabled;
  const css = styled ? sanitizeCss(data.header.customCss, data.header.username).css : "";

  // The owner's links are in the title box and the log's header instead, so
  // the strip is only ever the report button, for a signed-in reader.
  const bar =
    viewer && !data.header.isOwner ? (
      <ReportButton target={{ kind: "log", name: data.header.username }} label="Report this log" />
    ) : null;

  const reader = viewer
    ? {
        username: viewer,
        isOwner: data.header.isOwner,
        blocked: data.header.viewerBlocked,
        canPost: data.header.viewerCanPost,
      }
    : null;

  // The owner's way to their settings sits in the site's own title box, on
  // its own line, the way OwnerNav puts the same links on the settings pages,
  // where no stylesheet of theirs can hide it. The log's header repeats the
  // edit link next to Hiscores, where the eye already goes.
  const links = [
    { href: "/adventurer-log", text: "All Adventurer Logs" },
    ...(data.header.isOwner
      ? [
          { href: "/account/adventurer-log", text: "Edit your log", br: true },
          { href: "/account/adventurer-log/outfits", text: "Outfits" },
        ]
      : []),
  ];

  return (
    <Frame>
      <TitleBox title="Adventurer Log" links={links} />
      <LogView
        header={data.header}
        name={data.name}
        skills={data.skills}
        first={data.first}
        show={data.show}
        pinned={data.pinned}
        bar={bar}
        viewer={reader}
        css={css}
        outfits={data.outfits}
        records={data.records}
      />
    </Frame>
  );
}

function Unavailable({ text }: { text: string }) {
  return (
    <Frame>
      <TitleBox title="Adventurer Log" />
      <Panel>
        <p>{text}</p>
      </Panel>
    </Frame>
  );
}
