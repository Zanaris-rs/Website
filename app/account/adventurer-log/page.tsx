import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import AboutYou from "@/components/adventurer-log/AboutYou";
import BlockList from "@/components/adventurer-log/BlockList";
import CssEditor from "@/components/adventurer-log/CssEditor";
import LogView from "@/components/adventurer-log/LogView";
import OwnerNav from "@/components/adventurer-log/OwnerNav";
import styles from "@/components/adventurer-log/Settings.module.css";
import Frame from "@/components/site/Frame";
import Panel from "@/components/site/Panel";
import TitleBox from "@/components/site/TitleBox";
import { loadAccount } from "@/lib/account/profile-server";
import { requireSession } from "@/lib/account/session-server";
import { sanitizeCss } from "@/lib/adventurer-log/css";
import { CSS_MAX } from "@/lib/adventurer-log/format";
import { loadLogPage, type LogPageData } from "@/lib/adventurer-log/page-data";
import { blocksStatement, type LogHeader, logStatement, parseBlocks, parseLog } from "@/lib/adventurer-log/queries";
import { toDisplayName } from "@/lib/base37";
import { query } from "@/lib/db";

export const metadata: Metadata = {
  title: "Your Adventurer Log",
  description: "What your Adventurer Log says about you, and what it shows.",
};

export const dynamic = "force-dynamic";

/**
 * `/account/adventurer-log` — the owner's settings for their own log, in
 * three boxes: what it says about them (one Save), its stylesheet with a
 * preview of the log under it, and who may not reply on it.
 */
export default async function LogSettingsPage() {
  const session = await requireSession();
  const loaded = await loadAccount(session);

  if (loaded.status === "signed_out") redirect("/account/login");
  if (loaded.status === "unavailable") return <Unavailable />;

  const { username } = loaded.profile;
  let header: LogHeader;
  let blocked: { username: string; name: string }[];
  try {
    const statement = logStatement(username, username);
    header = parseLog(await query<Record<string, unknown>>(statement.text, statement.values));
    const blocks = blocksStatement(username);
    blocked = parseBlocks(await query<Record<string, unknown>>(blocks.text, blocks.values)).map((row) => ({
      username: row.username,
      name: toDisplayName(row.username),
    }));
  } catch (error) {
    console.error("[adventurer-log] settings read failed", error);
    return <Unavailable />;
  }
  if (header.result !== "ok") return <Unavailable />;

  // The style box's preview: the log as a visitor reads it (no one signed
  // in, so the last 20 minutes are not on it yet, and nothing on it offers to
  // post, reply or report), drawn without a stylesheet - the editor draws the
  // draft on it. The settings still work if it cannot be read.
  let visitor: LogPageData | null = null;
  try {
    visitor = await loadLogPage(username, null);
  } catch (error) {
    console.error("[adventurer-log] settings preview read failed", error);
  }
  const preview: ReactNode =
    visitor?.result === "ok" ? (
      <LogView
        header={visitor.header}
        name={visitor.name}
        skills={visitor.skills}
        first={visitor.first}
        viewer={null}
        css=""
      />
    ) : null;
  const sanitised = header.cssDisabled ? { css: "", dropped: [] } : sanitizeCss(header.customCss, username, CSS_MAX);

  return (
    <Frame>
      <OwnerNav title="Your Adventurer Log" username={username} current="edit" />
      <Panel align="left" width="100%">
        <h2 className={styles.title}>About you</h2>
        <AboutYou
          initial={{ headline: header.headline, about: header.about, hidden: header.hiddenCategories }}
        />
      </Panel>
      <Panel align="left" width="100%">
        <h2 className={styles.title}>Your adventurer log&rsquo;s style</h2>
        <CssEditor
          initial={header.customCss}
          disabled={header.cssDisabled}
          sanitised={sanitised}
          preview={preview}
        />
      </Panel>
      <Panel align="left" width="100%">
        <h2 className={styles.title}>Blocked players</h2>
        <BlockList initial={blocked} />
      </Panel>
    </Frame>
  );
}

function Unavailable() {
  return (
    <Frame>
      <TitleBox title="Your Adventurer Log" links={[{ href: "/account", text: "Account Centre" }]} />
      <Panel>
        <p>Your Adventurer Log is unavailable right now. Try again shortly.</p>
      </Panel>
    </Frame>
  );
}
