import type { Metadata } from "next";
import { redirect } from "next/navigation";

import BlockList from "@/components/adventurer-log/BlockList";
import LogSettings from "@/components/adventurer-log/LogSettings";
import Frame from "@/components/site/Frame";
import Panel from "@/components/site/Panel";
import TitleBox from "@/components/site/TitleBox";
import { loadAccount } from "@/lib/account/profile-server";
import { requireSession } from "@/lib/account/session-server";
import { blocksStatement, type LogHeader, logStatement, parseBlocks, parseLog } from "@/lib/adventurer-log/queries";
import { toDisplayName } from "@/lib/base37";
import { query } from "@/lib/db";

export const metadata: Metadata = {
  title: "Your Adventurer Log",
  description: "What your Adventurer Log says about you, and what it shows.",
};

export const dynamic = "force-dynamic";

/** `/account/adventurer-log` — the owner's settings for their own log. */
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

  return (
    <Frame>
      <TitleBox
        title="Your Adventurer Log"
        links={[
          { href: `/adventurer-log/${encodeURIComponent(username)}`, text: "View your log" },
          { href: "/account/adventurer-log/outfits", text: "Outfits" },
          { href: "/account", text: "Account Centre" },
        ]}
      />
      <Panel align="left" width="100%">
        <LogSettings headline={header.headline} about={header.about} hidden={header.hiddenCategories} />
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
