import TitleBox from "@/components/site/TitleBox";
import { CHARACTER_HREF, CLAN_TAB_HREF, LOG_SETTINGS_HREF, logHref } from "@/lib/adventurer-log/href";
import { COMMUNITY_BAR_WIDTH, COMMUNITY_HREF } from "@/lib/community/href";
import { SET_RECORD_HREF } from "@/lib/records/api";

/**
 * The owner has three homes besides the log itself - Character (who you
 * are), Clan (who you're with) and Log settings (how the log reads) - and
 * each links to the others from its title box, the way `/economy`'s sections
 * do: View your log · Character · Clan · Records · Log settings · Community.
 * Records is their own Start/Stop page, which carries this box too ("Your
 * records"); Community is the hub the log is part of. The Account Centre
 * stays on the title page and in Account Services.
 */
export default function OwnerNav({
  title,
  username,
  current,
}: {
  title: string;
  /** The owner's username, for the link to their log. */
  username: string;
  current: "character" | "clan" | "records" | "settings";
}) {
  return (
    <TitleBox
      title={title}
      width={COMMUNITY_BAR_WIDTH}
      links={[
        { href: logHref(username), text: "View your log" },
        { href: CHARACTER_HREF, text: "Character", current: current === "character" },
        { href: CLAN_TAB_HREF, text: "Clan", current: current === "clan" },
        { href: SET_RECORD_HREF, text: "Records", current: current === "records" },
        { href: LOG_SETTINGS_HREF, text: "Log settings", current: current === "settings" },
        { href: COMMUNITY_HREF, text: "Community" },
      ]}
    />
  );
}
