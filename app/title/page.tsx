import type { Metadata } from "next";

import ChatheadFace from "@/components/game/ChatheadFace";
import ItemIcon from "@/components/game/ItemIcon";
import SkillIcon from "@/components/game/SkillIcon";
import Frame from "@/components/site/Frame";
import MenuTile from "@/components/site/MenuTile";
import styles from "@/components/site/Site.module.css";
import frame from "@/components/site/Frame.module.css";
import StonePanel from "@/components/site/StonePanel";
import Tile from "@/components/site/Tile";
import Wordmark from "@/components/site/Wordmark";
import { readSession } from "@/lib/account/session-server";
import { formatWhen } from "@/lib/adventurer-log/format";
import { latest } from "@/lib/news";
import { formatShortDate, listHref, postHref } from "@/lib/news/parse";
import { KIT_RELEASES_URL, LOSTHQ_URL, SITE_NAME } from "@/lib/site";
import { loadStaff } from "@/lib/staff/staff-server";
import { countPlayers, worldList } from "@/lib/title/fetch";
import { latestLogs } from "@/lib/title/logs";
import { titleTileSrc } from "@/lib/title/tiles";
import { playingSentence } from "@/lib/title/players";
import { showsStaffTile } from "@/lib/title/staff";

export const metadata: Metadata = {
  title: { absolute: "Zanaris" },
  description:
    "A free Lost City (2004scape) server. Play RuneScape as it was in 2004, in your browser.",
};

/**
 * Rendered per request, because the page reads the session cookie to decide
 * whether to show the Staff Inbox tile, and a prerendered page cannot know
 * who is looking at it. The world polls behind the player count are still
 * cached: `countPlayers` tags each fetch with its own fifteen-second
 * revalidation, which a route-level `0` leaves alone (it only changes the
 * default for fetches that set nothing). `dynamic = "force-dynamic"` would
 * not — it forces every fetch to `no-store` and would ask every world on
 * every visit. The Adventurer Logs are cached the same way, for a minute
 * (`latestLogs`).
 */
export const revalidate = 0;

/** The main menu: what Lost City's `/title` is, under our name. */
export default async function Title() {
  const [players, session, logs] = await Promise.all([
    countPlayers(worldList()),
    readSession(),
    latestLogs(),
  ]);
  // Only a signed-in visitor costs a database read; the verdict decides one
  // tile and nothing else, so no outcome redirects or errors.
  const staff = session ? await loadStaff(session) : null;
  const staffTile = showsStaffTile(staff);
  const posts = latest(5);

  return (
    <Frame>
      <div className={styles.hero}>
        <div className={styles.heroBrand}>
          <Wordmark />
          <div className={styles.playing}>{playingSentence(players)}</div>
        </div>

        <StonePanel
          title="Latest News and Updates"
          className={styles.sectionPanel}
        >
          <div className={styles.newsBlock}>
            <div className={styles.newsTile}>
              {/* Decorative: the same href is reached by every headline beside
                  it and by the "Click Here" below, both of which have names.
                  An unlabelled third link would only add noise to a screen
                  reader. */}
              <a href={listHref()} aria-hidden="true" tabIndex={-1}>
                <Tile src="/img/title/mm_scroll.jpg" width={77} height={120} />
              </a>
            </div>
            <table className={styles.newsRows}>
              <tbody>
                {posts.map((post) => (
                  <tr key={post.slug}>
                    <td>
                      <a href={postHref(post.slug)} className={frame.link}>
                        {post.title}
                      </a>
                    </td>
                    <td className={styles.newsDate}>
                      {formatShortDate(post.date)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={styles.newsFooter}>
            To view a full list of news and updates,{" "}
            <a href={listHref()} className={frame.linkGreen}>
              Click Here
            </a>
            .
          </div>
        </StonePanel>
      </div>

      <div className={styles.sections}>
        <StonePanel title="Main Features" className={styles.sectionPanel}>
          <div className={styles.tileGrid}>
            <MenuTile
              variant="red"
              href="/serverlist"
              image="/img/title/mm_sword.jpg"
              caption="Play Game (Existing User)"
              blurb={`Play ${SITE_NAME} right now!`}
            />
            <MenuTile
              variant="red"
              href="/register"
              image="/img/title/mm_player.jpg"
              caption="Invited?"
              blurb="Claim your invite."
            />
            <MenuTile
              href="/hiscores"
              image="/img/title/mm_chalice.jpg"
              caption="Hiscores Table"
              blurb="See how you compare to other players!"
            />
          </div>
        </StonePanel>

        {/* The first few rows of /adventurer-log: whose log last showed
            something, and what. Everything here is at least as old as the
            logs make it (twenty minutes for an adventure), so the list
            gives away nothing about who is online. */}
        <StonePanel title="Adventurer Logs" className={styles.sectionPanel}>
          {logs === null ? (
            <p className={styles.logsNotice}>
              Adventurer Logs are unavailable right now.
            </p>
          ) : logs.length === 0 ? (
            <p className={styles.logsNotice}>
              Nobody has anything to show yet.
            </p>
          ) : (
            <ul className={styles.logRows}>
              {logs.map((entry) => (
                <li key={entry.username} className={styles.logRow}>
                  <ChatheadFace
                    look={entry.look}
                    size={40}
                    label={`${entry.name}'s chathead`}
                    className={styles.logFace}
                  />
                  <div className={styles.logText}>
                    <a
                      href={`/adventurer-log/${encodeURIComponent(entry.username)}`}
                      className={`${frame.link} ${styles.logName}`}
                    >
                      {entry.name}
                    </a>
                    <div className={styles.logActivity}>
                      {entry.icon ? (
                        <span className={styles.logIcon} aria-hidden>
                          {entry.icon.type === "skill" ? (
                            <SkillIcon stat={entry.icon.stat} size={18} />
                          ) : (
                            <ItemIcon id={entry.icon.id} size={18} />
                          )}
                        </span>
                      ) : null}
                      <span className={styles.logActivityText}>
                        {entry.activity}
                      </span>
                    </div>
                    <time className={styles.logTime} dateTime={entry.at}>
                      {formatWhen(entry.at)}
                    </time>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className={styles.newsFooter}>
            Every player&rsquo;s levels, quests and rare drops, and what they
            have to say about them. To see every log,{" "}
            <a href="/adventurer-log" className={frame.linkGreen}>
              Click Here
            </a>
            . To write on your own,{" "}
            <a href="/account/adventurer-log" className={frame.linkGreen}>
              {session ? "Click Here" : "Login"}
            </a>
            .
          </div>
        </StonePanel>

        <StonePanel title="Account Services" className={styles.sectionPanel}>
          <div
            className={`${styles.tileGrid} ${staffTile ? "" : styles.tileGridPair}`}
          >
            <MenuTile
              href="/account"
              image="/img/title/mm_security.jpg"
              caption="Account Centre"
              blurb="Manage your characters."
              linkText="Login"
            />
            <MenuTile
              href="/messages"
              image="/img/title/mm_message.jpg"
              caption="Message Centre"
              blurb="Communicate with our staff."
              linkText="Login"
            />
            {staffTile ? (
              <MenuTile
                href="/staff"
                image="/img/title/mm_scroll.jpg"
                caption="Staff Inbox"
                blurb="Tickets and reports waiting for staff."
                linkText="Open"
              />
            ) : null}
          </div>
        </StonePanel>

        <StonePanel
          title="Game Rules & Resources"
          className={styles.sectionPanel}
        >
          <div className={styles.tileGrid}>
            <MenuTile
              href="/rules"
              image="/img/title/mm_rules.jpg"
              caption="Rules"
              blurb="Inform yourself on how to play safely."
            />
            <MenuTile
              href="/worldmap"
              image="/img/title/mm2_rs2b.jpg"
              caption="World Map"
              blurb="Great for finding your way around."
            />
            {/* Two pictures 2004 drew for pages it had and we do not, put to
                work on two pages we have and it did not: a chest with a
                padlock through its hasp, and scales over a ledger of coins. */}
            <MenuTile
              href="/bans"
              image="/img/title/mm_vote.jpg"
              caption="Ban Record"
              blurb="Every ban and mute, permanently public."
            />
            <MenuTile
              href="/economy"
              image="/img/title/mm_accman.jpg"
              caption="The Economy"
              blurb="Every item in the game, counted every hour."
            />
            {/* Last, because these two are the links that leave the site.
                Six tiles fill both grids: three rows of two, or two of
                three.

                Nothing in the 2004 set is about either of them, so both are
                drawn from the game itself (`scripts/game-icons/render.ts`):
                a sextant for the wiki that works out where you are, and the
                staff you have to be holding to reach Zanaris. Both go through
                `titleTileSrc`, which versions the URL — everything under
                /img/game is cached for a year. */}
            <MenuTile
              href={LOSTHQ_URL}
              image={titleTileSrc("sextant") ?? undefined}
              caption="LostHQ"
              blurb="Community guides, quest walkthroughs, calculators and item database."
              linkText="Visit"
            />
            <MenuTile
              href={KIT_RELEASES_URL}
              image={titleTileSrc("dramen-staff") ?? undefined}
              caption="Zanaris Kit"
              blurb="Our open-source desktop client, still early. Pick your download on GitHub."
              linkText="Download"
            />
          </div>
        </StonePanel>
      </div>
    </Frame>
  );
}
