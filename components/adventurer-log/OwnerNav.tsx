import TitleBox from "@/components/site/TitleBox";
import { CHARACTER_HREF, CLAN_TAB_HREF, LOG_SETTINGS_HREF, logHref } from "@/lib/adventurer-log/href";

/**
 * The owner has three homes besides the log itself - Character (who you
 * are), Clan (who you're with) and Log settings (how the log reads) - and
 * each links to the others from its title box, the way `/economy`'s sections
 * do, with the Account Centre they are reached from.
 */
export default function OwnerNav({
  title,
  username,
  current,
}: {
  title: string;
  /** The owner's username, for the link to their log. */
  username: string;
  current: "character" | "clan" | "settings";
}) {
  return (
    <TitleBox
      title={title}
      width="min(460px, 100%)"
      links={[
        { href: logHref(username), text: "View your log" },
        { href: CHARACTER_HREF, text: "Character", current: current === "character" },
        { href: CLAN_TAB_HREF, text: "Clan", current: current === "clan" },
        { href: LOG_SETTINGS_HREF, text: "Log settings", current: current === "settings" },
        { href: "/account", text: "Account Centre" },
      ]}
    />
  );
}
