import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import ReportButton from "@/components/adventurer-log/ReportButton";
import ClanPhoto from "@/components/clans/ClanPhoto";
import styles from "@/components/clans/Clans.module.css";
import Crest from "@/components/clans/Crest";
import RankIcon from "@/components/clans/RankIcon";
import ChatheadFace from "@/components/game/ChatheadFace";
import ChatText from "@/components/game/ChatText";
import frame from "@/components/site/Frame.module.css";
import Frame from "@/components/site/Frame";
import Panel from "@/components/site/Panel";
import TitleBox from "@/components/site/TitleBox";
import { readSession } from "@/lib/account/session-server";
import { formatMonth, formatWhen } from "@/lib/adventurer-log/format";
import { logHref } from "@/lib/adventurer-log/href";
import { toDisplayName } from "@/lib/base37";
import type { Look } from "@/lib/chathead/look";
import { crestName } from "@/lib/clans/crests";
import { clanHref, CLANS_HREF } from "@/lib/clans/href";
import { slugFrom } from "@/lib/clans/names";
import { type LoadedClan, loadClan, loadPhotoSitters, type PhotoSitter } from "@/lib/clans/page-data";
import { byRank, RANK_NAMES } from "@/lib/clans/ranks";
import { clanWorldName } from "@/lib/clans/worlds";
import { chatheadLooks } from "@/lib/outfits/looks";
import { photoSitters, photoSpot } from "@/lib/scenes/photo";

export const dynamic = "force-dynamic";

/** One read of a clan per request, shared by the title and the page. */
const clanFor = cache(loadClan);

export async function generateMetadata({ params }: PageProps<"/clan/[slug]">): Promise<Metadata> {
  const slug = slugFrom((await params).slug);
  if (!slug) return { title: "Clan" };
  try {
    const loaded = await clanFor(slug);
    if (!loaded) return { title: "Clan" };
    const { clan } = loaded;
    const title = `${clan.name}, a clan on Zanaris`;
    const description =
      clan.motto || `${clan.name}: ${clan.members} ${clan.members === 1 ? "member" : "members"} on Zanaris.`;
    // One address per clan: the stored slug, whatever case or spaces the
    // reader typed (`slugFrom` forgives them).
    return {
      title: clan.name,
      description,
      alternates: { canonical: clanHref(clan.slug) },
      openGraph: { title, description },
    };
  } catch {
    return { title: "Clan" };
  }
}

/**
 * `/clan/<slug>` - a clan's public page. The left column is its card: the
 * crest on a shield, the name, the motto in the game's font, the clan photo
 * (members in their outfits, in the Leader's scene), and a sheet (Leader,
 * Founded, Members, World, Crest). The right column has About, Notices,
 * newest first, and the members by rank. Banned players are in none of it
 * (migration 17). A signed-in reader who is not a member gets the report
 * button, in the site's strip above the page. An unknown slug is a 404, as is
 * a clan's old slug after a rename. A clan whose every member is banned still
 * has its page, with no one listed and the scene alone in its photo.
 */
export default async function ClanPage({ params }: PageProps<"/clan/[slug]">) {
  const slug = slugFrom((await params).slug);
  if (!slug) notFound();

  let loaded: LoadedClan | null;
  try {
    loaded = await clanFor(slug);
  } catch (error) {
    console.error("[clans] clan page read failed", error);
    return <Unavailable />;
  }
  if (!loaded) notFound();
  const { clan, members, notices } = loaded;

  const session = await readSession();
  const viewer = session?.u ?? null;
  const isMember = viewer !== null && members.some((member) => member.username === viewer);

  // The roster's chatheads are a nicety: the page stands without them.
  let looks = new Map<string, Look>();
  try {
    looks = await chatheadLooks(members.map((member) => member.username));
  } catch (error) {
    console.error("[clans] roster chatheads failed", error);
  }

  // The clan photo:
  // - who: the top ranks with a saved outfit, as many as the spot holds;
  // - where: the Leader's scene when it has proved slots, else Varrock square.
  // A failed read leaves the scene alone in the frame.
  let sitters: PhotoSitter[] = [];
  let leaderScene: string | null = null;
  try {
    ({ sitters, leaderScene } = await loadPhotoSitters(clan.leader, members));
  } catch (error) {
    console.error("[clans] clan photo read failed", error);
  }
  const photoAt = photoSpot(leaderScene);
  const placed = photoSitters(photoAt, sitters);

  const world = clanWorldName(clan.world);
  const crest = crestName(clan.crest);

  return (
    <Frame>
      <TitleBox title={clan.name} links={[{ href: CLANS_HREF, text: "All clans" }]} />
      {viewer && !isMember ? (
        <div className={styles.bar}>
          <ReportButton target={{ kind: "clan", id: clan.id }} label="Report this clan" />
        </div>
      ) : null}

      <div className={styles.page}>
        <aside className={styles.side}>
          <section className={`${styles.box} ${styles.card}`}>
            <Crest id={clan.crest} size="l" label={`Crest: ${crest}`} />
            <h1 className={styles.cardName}>{clan.name}</h1>
            {clan.motto ? (
              <p className={styles.motto}>
                <ChatText text={clan.motto} colour={0} effect={0} />
              </p>
            ) : null}
            <ClanPhoto
              spot={photoAt}
              looks={placed.map((sitter) => sitter.look)}
              names={placed.map((sitter) => toDisplayName(sitter.username))}
            />
            <dl className={styles.sheet}>
              {clan.leader ? (
                <div>
                  <dt>Leader</dt>
                  <dd>
                    <RankIcon rank="leader" className={styles.rankIcon} />{" "}
                    <a className={frame.link} href={logHref(clan.leader)}>
                      {toDisplayName(clan.leader)}
                    </a>
                  </dd>
                </div>
              ) : null}
              <div>
                <dt>Founded</dt>
                <dd>{formatMonth(clan.createdAt)}</dd>
              </div>
              <div>
                <dt>Members</dt>
                <dd>{clan.members}</dd>
              </div>
              {world ? (
                <div>
                  <dt>World</dt>
                  <dd>{world}</dd>
                </div>
              ) : null}
              <div>
                <dt>Crest</dt>
                <dd>{crest}</dd>
              </div>
            </dl>
          </section>
        </aside>

        <div className={styles.main}>
          {clan.about ? (
            <section className={styles.box}>
              <h2>About {clan.name}</h2>
              <div className={styles.boxBody}>
                <p className={styles.about}>{clan.about}</p>
              </div>
            </section>
          ) : null}

          <section className={styles.box}>
            <h2>Notices</h2>
            <div className={styles.boxBody}>
              {notices.length === 0 ? (
                <p className={styles.empty}>No notices yet.</p>
              ) : (
                <ul className={styles.notices}>
                  {notices.map((notice) => (
                    <li key={notice.id} className={styles.notice}>
                      <div className={styles.noticeHead}>
                        <b>{notice.title}</b>
                        <span className={styles.muted}>
                          {notice.authorRank ? <RankIcon rank={notice.authorRank} className={styles.rankIcon} /> : null}{" "}
                          <a className={frame.link} href={logHref(notice.author)}>
                            {toDisplayName(notice.author)}
                          </a>{" "}
                          &middot; <time dateTime={notice.createdAt}>{formatWhen(notice.createdAt)}</time>
                        </span>
                      </div>
                      <p className={styles.noticeBody}>{notice.body}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className={styles.box}>
            <h2>Members</h2>
            <div className={styles.boxBody}>
              {members.length === 0 ? <p className={styles.empty}>No members to show just now.</p> : null}
              {byRank(members).map((group) => (
                <div key={group.rank}>
                  <h3 className={styles.rankHead}>
                    <RankIcon rank={group.rank} className={styles.rankIcon} /> {RANK_NAMES[group.rank]}
                    {group.members.length > 1 ? "s" : ""}
                  </h3>
                  <ul className={styles.members}>
                    {group.members.map((member) => {
                      const name = toDisplayName(member.username);
                      return (
                        <li key={member.username} className={styles.member}>
                          <ChatheadFace
                            look={looks.get(member.username) ?? null}
                            size={32}
                            label={`${name}'s chathead`}
                            className={styles.face}
                          />
                          <a className={`${frame.link} ${styles.memberName}`} href={logHref(member.username)}>
                            {name}
                          </a>
                          <span className={styles.muted}>
                            <RankIcon rank={member.rank} className={styles.rankIcon} /> {RANK_NAMES[member.rank]}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </Frame>
  );
}

function Unavailable() {
  return (
    <Frame>
      <TitleBox title="Clan" links={[{ href: CLANS_HREF, text: "All clans" }]} />
      <Panel>
        <p>Clans are unavailable right now. Try again shortly.</p>
      </Panel>
    </Frame>
  );
}
