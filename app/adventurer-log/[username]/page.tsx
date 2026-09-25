import type { Metadata } from "next";
import { notFound } from "next/navigation";

import LogView from "@/components/adventurer-log/LogView";
import ReportButton from "@/components/adventurer-log/ReportButton";
import Frame from "@/components/site/Frame";
import Panel from "@/components/site/Panel";
import TitleBox from "@/components/site/TitleBox";
import { readSession } from "@/lib/account/session-server";
import { sanitizeCss } from "@/lib/adventurer-log/css";
import { loadLogPage, type LogPageData } from "@/lib/adventurer-log/page-data";
import { INVALID_NAME, toDisplayName, toSafeName } from "@/lib/base37";

export const dynamic = "force-dynamic";

type Params = {
  params: Promise<{ username: string }>;
};

function nameFrom(raw: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }
  const safe = toSafeName(decoded);
  return safe === INVALID_NAME ? null : safe;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const name = nameFrom((await params).username);
  if (!name) return { title: "Adventurer Log" };
  const display = toDisplayName(name);
  return {
    title: `${display}'s Adventurer Log`,
    description: `${display}'s adventures, updates and outfits on Zanaris.`,
  };
}

/**
 * `/adventurer-log/<name>` — a player's public page. Anyone can read it;
 * what the viewer may do on it is decided by the database from the signed
 * session's name (the header's `is_owner`, `viewer_can_post`).
 */
export default async function AdventurerLog({ params }: Params) {
  const username = nameFrom((await params).username);
  if (!username) notFound();

  const session = await readSession();
  const viewer = session?.u ?? null;

  let data: LogPageData;
  try {
    data = await loadLogPage(username, viewer);
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

  const bar = data.header.isOwner ? (
    <>
      <span>This is your Adventurer Log.</span>
      <a href="/account/adventurer-log">Edit your log</a>
      <a href="/account/adventurer-log/outfits">Outfits</a>
    </>
  ) : viewer ? (
    <ReportButton target={{ kind: "log", name: data.header.username }} label="Report this log" />
  ) : null;

  const reader = viewer
    ? { username: viewer, isOwner: data.header.isOwner, canPost: data.header.viewerCanPost }
    : null;

  return (
    <Frame>
      <TitleBox title="Adventurer Log" links={[{ href: "/adventurer-log", text: "All Adventurer Logs" }]} />
      <LogView
        header={data.header}
        name={data.name}
        skills={data.skills}
        first={data.first}
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
