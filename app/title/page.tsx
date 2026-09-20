import type { Metadata } from "next";

import Frame from "@/components/site/Frame";
import MenuTile from "@/components/site/MenuTile";
import styles from "@/components/site/Site.module.css";
import frame from "@/components/site/Frame.module.css";
import StonePanel from "@/components/site/StonePanel";
import Tile from "@/components/site/Tile";
import Wordmark from "@/components/site/Wordmark";
import { readSession } from "@/lib/account/session-server";
import { latest } from "@/lib/news";
import { formatShortDate, listHref, postHref } from "@/lib/news/parse";
import { KIT_RELEASES_URL, LOSTHQ_URL, SITE_NAME } from "@/lib/site";
import { loadStaff } from "@/lib/staff/staff-server";
import { countPlayers, worldList } from "@/lib/title/fetch";
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
 * every visit.
 */
export const revalidate = 0;

/** The main menu: what Lost City's `/title` is, under our name. */
export default async function Title() {
  const [players, session] = await Promise.all([
    countPlayers(worldList()),
    readSession(),
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
            {/* The two transparency pages and LostHQ have no 2004 picture of
                their own, so all three borrow the news scroll: each is a
                record to be read, which is what the scroll stands for. */}
            <MenuTile
              href="/bans"
              image="/img/title/mm_scroll.jpg"
              caption="Ban Record"
              blurb="Every ban and mute, permanently public."
            />
            <MenuTile
              href="/economy"
              image="/img/title/mm_casket.jpg"
              caption="The Economy"
              blurb="Every item in the game, counted every hour."
            />
            {/* Last, because these two are the links that leave the site.
                Six tiles fill both grids: three rows of two, or two of
                three. */}
            <MenuTile
              href={LOSTHQ_URL}
              image="/img/title/mm_scroll.jpg"
              caption="LostHQ"
              blurb="Community guides, quest walkthroughs, calculators and item database."
              linkText="Visit"
            />
            <MenuTile
              href={KIT_RELEASES_URL}
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
