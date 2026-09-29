import type { Metadata } from "next";
import type { ReactNode } from "react";

import dir from "@/components/adventurer-log/Directory.module.css";
import DirectoryEntryRow from "@/components/adventurer-log/DirectoryEntryRow";
import Crest from "@/components/clans/Crest";
import styles from "@/components/community/Community.module.css";
import Square from "@/components/community/Square";
import ChatheadFace from "@/components/game/ChatheadFace";
import ChatText from "@/components/game/ChatText";
import frame from "@/components/site/Frame.module.css";
import Frame from "@/components/site/Frame";
import TitleBox from "@/components/site/TitleBox";
import { readSession } from "@/lib/account/session-server";
import { DIRECTORY_HREF, logHref } from "@/lib/adventurer-log/href";
import { crestName } from "@/lib/clans/crests";
import { clanHref, CLANS_HREF } from "@/lib/clans/href";
import { COMMUNITY_BAR_WIDTH, communityLinks, HISCORES_HREF, yourLogLinks } from "@/lib/community/href";
import { loadHub, loadYourLook } from "@/lib/community/hub";
import { displayName, formatNumber } from "@/lib/hiscores/format";
import { BOARD_PATH } from "@/lib/records/api";

export const metadata: Metadata = {
  title: "Community",
  description:
    "Who's about in Varrock square, the top of the hiscores, the record holders, the latest from every Adventurer Log, and the clans.",
};

export const dynamic = "force-dynamic";

/** A hub box: a grey title bar, then its body. */
function Box({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section className={styles.box} aria-labelledby={id}>
      <h2 id={id} className={styles.boxTitle}>
        {title}
      </h2>
      <div className={styles.boxBody}>{children}</div>
    </section>
  );
}

function More({ href, children }: { href: string; children: ReactNode }) {
  return (
    <p className={styles.more}>
      <a className={frame.link} href={href}>
        {children} &raquo;
      </a>
    </p>
  );
}

/** A box that could not be read says so in one line; the rest of the page stands. */
function Unavailable({ line }: { line: string }) {
  return <p className={styles.notice}>{line}</p>;
}

/**
 * `/community` - the Community hub, where the hiscores, the records, the
 * Adventurer Logs and the clans meet. First the square: the adventurers most
 * recently about, standing in Varrock square and speaking their greetings.
 * Beside it, your own log's links (or a way in), a box to find anyone's log,
 * the top five on the hiscores and each duration's record holder. Under
 * them, the latest from the logs and the largest clans. Every name opens
 * that player's Adventurer Log.
 *
 * Each box reads on its own (`loadHub`): one that fails says so in a line,
 * and the rest of the page stands.
 */
export default async function Community() {
  const session = await readSession();
  const me = session?.u ?? null;
  // Your own chathead needs only your name, so it is read alongside the boxes.
  const [hub, myLook] = await Promise.all([loadHub(), me ? loadYourLook(me) : null]);

  // "View your log" here, where the row stands alone rather than under a title.
  const yours = me
    ? yourLogLinks(me, false).map((link) => (link.href === logHref(me) ? { ...link, text: "View your log" } : link))
    : [];

  return (
    <Frame>
      <TitleBox title="Community" links={communityLinks("community")} width={COMMUNITY_BAR_WIDTH} />
      <div className={styles.hub}>
        <div className={styles.first}>
          {hub.square.ok ? <Square sitters={hub.square.value} /> : <Square sitters={[]} unavailable />}

          <div className={styles.side}>
            <Box id="hub-yours" title="Your log">
              {me ? (
                <div className={styles.you}>
                  <ChatheadFace look={myLook} size={34} label={`${displayName(me)}'s chathead`} className={styles.face} />
                  <div>
                    <b className={styles.youName}>{displayName(me)}</b>
                    <p className={styles.youLinks}>
                      {yours.map((link, i) => (
                        <span key={link.href}>
                          {i > 0 ? " · " : null}
                          <a className={frame.link} href={link.href}>
                            {link.text}
                          </a>
                        </span>
                      ))}
                    </p>
                  </div>
                </div>
              ) : (
                <p className={styles.notice}>
                  <a className={frame.link} href="/account/login">
                    Log in to write your own Adventurer Log
                  </a>
                </p>
              )}
            </Box>

            <Box id="hub-find" title="Find a player">
              <form className={styles.find} action={DIRECTORY_HREF} method="get">
                <label htmlFor="hub-find-name">Player name</label>
                <input
                  id="hub-find-name"
                  name="name"
                  type="text"
                  maxLength={12}
                  autoComplete="off"
                  aria-describedby="hub-find-hint"
                />
                <button type="submit">Go</button>
              </form>
              <p id="hub-find-hint" className={styles.hint}>
                Opens their Adventurer Log.
              </p>
            </Box>

            <Box id="hub-top" title="Top of the hiscores">
              {!hub.top.ok ? (
                <Unavailable line="The hiscores are unavailable right now. Try again shortly." />
              ) : hub.top.value.length === 0 ? (
                <p className={styles.notice}>Nobody is on the hiscores yet.</p>
              ) : (
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col" className={styles.number}>
                        Rank
                      </th>
                      <th scope="col">Name</th>
                      <th scope="col" className={styles.number}>
                        Total level
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {hub.top.value.map((row) => (
                      <tr key={row.username}>
                        <td className={styles.number}>{formatNumber(row.rank)}</td>
                        <td>
                          <span className={styles.who}>
                            <ChatheadFace look={row.look} size={24} label={`${row.name}'s chathead`} className={styles.face} />
                            <a className={frame.link} href={logHref(row.username)}>
                              {row.name}
                            </a>
                          </span>
                        </td>
                        <td className={styles.number}>{formatNumber(row.totalLevel)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <More href={HISCORES_HREF}>Full hiscores</More>
            </Box>

            <Box id="hub-records" title="Record holders">
              {!hub.records.ok ? (
                <Unavailable line="Records are unavailable right now. Try again shortly." />
              ) : (
                <table className={styles.table}>
                  <tbody>
                    {hub.records.value.map((record) => (
                      <tr key={record.seconds}>
                        <th scope="row">{record.label}</th>
                        {record.holder ? (
                          <>
                            <td className={styles.number}>{formatNumber(record.holder.xp)} xp</td>
                            <td>
                              <a className={frame.link} href={logHref(record.holder.username)}>
                                {record.holder.name}
                              </a>
                            </td>
                          </>
                        ) : (
                          <td colSpan={2} className={styles.muted}>
                            No record yet
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <More href={BOARD_PATH}>Record board</More>
            </Box>
          </div>
        </div>

        <div className={styles.second}>
          <Box id="hub-recent" title="Recent activity">
            {!hub.recent.ok ? (
              <Unavailable line="Adventurer Logs are unavailable right now. Try again shortly." />
            ) : hub.recent.value.length === 0 ? (
              <p className={styles.notice}>Nobody has anything to show yet.</p>
            ) : (
              <ul className={dir.logs}>
                {hub.recent.value.map((entry) => (
                  <DirectoryEntryRow key={entry.username} entry={entry} />
                ))}
              </ul>
            )}
            <More href={DIRECTORY_HREF}>All Adventurer Logs</More>
          </Box>

          <Box id="hub-clans" title="Clans">
            {!hub.clans.ok ? (
              <Unavailable line="Clans are unavailable right now. Try again shortly." />
            ) : hub.clans.value.length === 0 ? (
              <p className={styles.notice}>No clans yet.</p>
            ) : (
              <ul className={styles.clans}>
                {hub.clans.value.map((clan) => (
                  <li key={clan.slug} className={styles.clan}>
                    <Crest id={clan.crest} size="s" label={`Crest: ${crestName(clan.crest)}`} />
                    <div className={styles.clanMain}>
                      <a className={frame.link} href={clanHref(clan.slug)}>
                        {clan.name}
                      </a>{" "}
                      <span className={styles.muted}>
                        {clan.members} {clan.members === 1 ? "member" : "members"}
                      </span>
                      {clan.motto ? (
                        <p className={styles.motto}>
                          <ChatText text={clan.motto} colour={0} effect={0} />
                        </p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <More href={CLANS_HREF}>All clans</More>
          </Box>
        </div>
      </div>
    </Frame>
  );
}
