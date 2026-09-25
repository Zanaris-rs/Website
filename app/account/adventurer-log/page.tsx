import type { Metadata } from "next";
import { redirect } from "next/navigation";

import AboutYou from "@/components/adventurer-log/AboutYou";
import BlockList, { type ManagedReply } from "@/components/adventurer-log/BlockList";
import CssEditor from "@/components/adventurer-log/CssEditor";
import OwnerNav from "@/components/adventurer-log/OwnerNav";
import styles from "@/components/adventurer-log/Settings.module.css";
import Frame from "@/components/site/Frame";
import Panel from "@/components/site/Panel";
import TitleBox from "@/components/site/TitleBox";
import { loadAccount } from "@/lib/account/profile-server";
import { requireSession } from "@/lib/account/session-server";
import { excerpt, parseBody } from "@/lib/adventurer-log/body";
import { sanitizeCss } from "@/lib/adventurer-log/css";
import { CSS_MAX } from "@/lib/adventurer-log/format";
import {
  blocksStatement,
  type LogHeader,
  logStatement,
  parseBlocks,
  parseLog,
  parseRecentReplies,
  recentRepliesStatement,
} from "@/lib/adventurer-log/queries";
import { toDisplayName } from "@/lib/base37";
import { query } from "@/lib/db";

export const metadata: Metadata = {
  title: "Your Adventurer Log",
  description: "What your Adventurer Log says about you, and what it shows.",
};

export const dynamic = "force-dynamic";

/**
 * `/account/adventurer-log` — the owner's settings for their own log, in
 * three boxes: what it says about them (one Save), its stylesheet, and who
 * may not reply on it. The log itself is one link away ("View your log").
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

  const dropped = header.cssDisabled ? [] : sanitizeCss(header.customCss, username, CSS_MAX).dropped;

  // The latest replies on the log, for managing them from here. A nicety:
  // if this one read fails, the rest of the page still works.
  let replies: ManagedReply[] | null = null;
  try {
    const recent = recentRepliesStatement(username);
    replies = parseRecentReplies(await query<Record<string, unknown>>(recent.text, recent.values)).map(
      (reply) => ({
        id: reply.replyId,
        author: reply.author,
        authorName: toDisplayName(reply.author),
        at: reply.createdAt,
        tokens: parseBody(reply.body),
        onUpdate: excerpt(reply.updateBody, 60),
      }),
    );
  } catch (error) {
    console.error("[adventurer-log] recent replies read failed", error);
  }

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
          dropped={dropped}
          logHref={`/adventurer-log/${encodeURIComponent(username)}`}
        />
      </Panel>
      <Panel align="left" width="100%">
        <h2 className={styles.title}>Blocked players</h2>
        <BlockList owner={username} initial={blocked} replies={replies} />
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
