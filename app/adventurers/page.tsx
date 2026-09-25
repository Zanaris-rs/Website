import type { Metadata } from "next";
import { redirect } from "next/navigation";

import styles from "@/components/adventurer-log/Directory.module.css";
import ChatheadFace from "@/components/game/ChatheadFace";
import ItemIcon from "@/components/game/ItemIcon";
import SkillIcon from "@/components/game/SkillIcon";
import frame from "@/components/site/Frame.module.css";
import Frame from "@/components/site/Frame";
import Panel from "@/components/site/Panel";
import TitleBox from "@/components/site/TitleBox";
import { type DirectoryPage, loadDirectory } from "@/lib/adventurer-log/directory";
import { formatWhen } from "@/lib/adventurer-log/format";
import { DIRECTORY_HREF, logHref } from "@/lib/adventurer-log/href";
import { logStatement, parseDirectoryCursor, parseLog } from "@/lib/adventurer-log/queries";
import { INVALID_NAME, toDisplayName, toSafeName } from "@/lib/base37";
import { query } from "@/lib/db";

export const metadata: Metadata = {
  title: "Adventurer Logs",
  description: "Every Zanaris player's Adventurer Log, the most recently active first.",
};

export const dynamic = "force-dynamic";

type Params = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function one(value: string | string[] | undefined): string | null {
  return typeof value === "string" ? value : null;
}

/**
 * `/adventurers` — the directory: every log with something to show,
 * ordered by the latest thing it shows the public (an adventure once its
 * twenty minutes are up, or an update), and a box to go to anyone's by name.
 * Nothing here is sooner or more than the logs themselves show; in
 * particular it is never ordered by when anyone logged in.
 */
export default async function AdventurerLogs({ searchParams }: Params) {
  const params = await searchParams;

  // The name box is a plain GET form, so it works without a script: a name
  // with a log goes to it, anything else stays here and says so.
  const wanted = one(params.name)?.trim() ?? "";
  let notice: string | null = null;
  if (wanted !== "") {
    const username = toSafeName(wanted);
    if (username === INVALID_NAME) {
      notice = "That is not a player's name.";
    } else {
      let found = false;
      try {
        const statement = logStatement(username, null);
        found = parseLog(await query<Record<string, unknown>>(statement.text, statement.values)).result === "ok";
      } catch (error) {
        console.error("[adventurer-log] directory search failed", error);
        notice = "Adventurer Logs are unavailable right now. Try again shortly.";
      }
      if (found) redirect(logHref(username));
      notice ??= `There is no Adventurer Log for ${toDisplayName(username)}.`;
    }
  }

  const before = parseDirectoryCursor(
    new URLSearchParams({ at: one(params.at) ?? "", after: one(params.after) ?? "" }),
  );

  let page: DirectoryPage;
  try {
    page = await loadDirectory(before);
  } catch (error) {
    console.error("[adventurer-log] directory read failed", error);
    return (
      <Frame>
        <TitleBox title="Adventurer Logs" />
        <Panel>
          <p>Adventurer Logs are unavailable right now. Try again shortly.</p>
        </Panel>
      </Frame>
    );
  }

  return (
    <Frame>
      <TitleBox title="Adventurer Logs" />
      <Panel width="100%">
        <form className={styles.search} action={DIRECTORY_HREF} method="get">
          <label htmlFor="log-name">Find a player&rsquo;s log</label>
          <input id="log-name" name="name" type="text" maxLength={12} defaultValue={wanted} autoComplete="off" />
          <button type="submit">Go</button>
        </form>
        {notice ? <p className={styles.notice}>{notice}</p> : null}

        {page.entries.length === 0 ? (
          <p className={styles.notice}>{before ? "There are no older logs." : "Nobody has anything to show yet."}</p>
        ) : (
          <ul className={styles.logs}>
            {page.entries.map((entry) => (
              <li key={entry.username} className={styles.log}>
                <ChatheadFace look={entry.look} size={48} label={`${entry.name}'s chathead`} className={styles.face} />
                <div className={styles.main}>
                  <a className={`${frame.link} ${styles.name}`} href={logHref(entry.username)}>
                    {entry.name}
                  </a>
                  {entry.headline ? <span className={styles.headline}>&ldquo;{entry.headline}&rdquo;</span> : null}
                  <div className={styles.activity}>
                    {entry.icon ? (
                      <span className={styles.icon} aria-hidden>
                        {entry.icon.type === "skill" ? (
                          <SkillIcon stat={entry.icon.stat} size={20} />
                        ) : (
                          <ItemIcon id={entry.icon.id} size={20} />
                        )}
                      </span>
                    ) : null}
                    <span>{entry.activity}</span>
                  </div>
                  <time className={styles.time} dateTime={entry.at}>
                    {formatWhen(entry.at)}
                  </time>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className={styles.pages}>
          {before ? (
            <a className={frame.link} href={DIRECTORY_HREF}>
              &laquo; Most recent
            </a>
          ) : (
            <span />
          )}
          {page.next ? (
            <a
              className={frame.link}
              href={`${DIRECTORY_HREF}?${new URLSearchParams({ at: page.next.at, after: page.next.username })}`}
            >
              Older &raquo;
            </a>
          ) : null}
        </div>
      </Panel>
    </Frame>
  );
}
