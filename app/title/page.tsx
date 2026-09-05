import type { Metadata } from "next";

import Frame from "@/components/site/Frame";
import MenuTile from "@/components/site/MenuTile";
import styles from "@/components/site/Site.module.css";
import frame from "@/components/site/Frame.module.css";
import StonePanel from "@/components/site/StonePanel";
import Tile from "@/components/site/Tile";
import { latest } from "@/lib/news";
import { formatShortDate, listHref, postHref } from "@/lib/news/parse";
import { SITE_NAME } from "@/lib/site";
import { countPlayers, worldList } from "@/lib/title/fetch";
import { playingSentence } from "@/lib/title/players";

export const metadata: Metadata = {
  title: { absolute: "Zanaris" },
  description:
    "A free Lost City (2004scape) server. Play RuneScape as it was in 2004, in your browser.",
};

/**
 * The player count is the only live thing on the site, so the page is
 * incrementally regenerated every fifteen seconds rather than rendered per
 * request: everyone gets a prerendered page, and one of them pays for the
 * worlds to be asked.
 */
export const revalidate = 15;

/** The main menu: what Lost City's `/title` is, under our name. */
export default async function Title() {
  const players = await countPlayers(worldList());
  const posts = latest(5);

  return (
    <Frame>
      <div className={styles.logo}>
        <Tile
          src="/img/title/logo.svg"
          width={312}
          height={100}
          alt={SITE_NAME}
        />
      </div>

      <div className={styles.playing}>{playingSentence(players)}</div>

      <div className={styles.sections}>
        <StonePanel title="Latest News and Updates">
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
            <a href={listHref()} className={frame.link}>
              Click Here
            </a>
            .
          </div>
        </StonePanel>

        <StonePanel title="Main Features">
          <div className={styles.tileRow}>
            <MenuTile
              layout="wide"
              variant="red"
              href="/serverlist"
              image="/img/title/mm_sword.jpg"
              caption="Play Game (Existing User)"
              blurb={`Play ${SITE_NAME} right now!`}
            />
            <MenuTile
              layout="wide"
              variant="red"
              href="/register"
              image="/img/title/mm_player.jpg"
              caption="Create Account (New User)"
              blurb="Create an account for both the game and our website."
            />
            <MenuTile
              layout="wide"
              href="/hiscores"
              image="/img/title/mm_chalice.jpg"
              caption="Hiscores Table"
              blurb="Is your character in the top 500,000?"
            />
          </div>
        </StonePanel>

        <StonePanel title="Secure Services">
          <div className={styles.tileRow}>
            <MenuTile
              layout="compact"
              href="/account"
              image="/img/title/mm_security.jpg"
              caption="Account Centre"
              blurb="Manage your characters."
              linkText="Login"
            />
            <MenuTile
              layout="compact"
              href="/messages"
              image="/img/title/mm_message.jpg"
              caption="Message Centre"
              blurb="Communicate with our staff."
              linkText="Login"
            />
          </div>
        </StonePanel>

        <StonePanel title="Other Features">
          <div className={styles.tileRow}>
            <MenuTile
              layout="compact"
              href="/rules"
              image="/img/title/mm_rules.jpg"
              caption="Rules"
              blurb="Inform yourself on how to play safely."
            />
            <MenuTile
              layout="compact"
              href="/worldmap"
              image="/img/title/mm2_rs2b.jpg"
              caption="World Map"
              blurb="Great for finding your way around."
            />
          </div>
        </StonePanel>
      </div>
    </Frame>
  );
}
