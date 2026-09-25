import TitleBox from "@/components/site/TitleBox";

/**
 * The owner's side of an Adventurer Log is three pages - the log as everyone
 * sees it, its settings, and the outfits its picture comes from - and each
 * links to the other two from its title box, the way `/economy`'s sections
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
  current: "edit" | "outfits";
}) {
  return (
    <TitleBox
      title={title}
      width="min(460px, 100%)"
      links={[
        { href: `/adventurer-log/${encodeURIComponent(username)}`, text: "View your log" },
        { href: "/account/adventurer-log", text: "Edit your log", current: current === "edit" },
        { href: "/account/adventurer-log/outfits", text: "Outfits", current: current === "outfits" },
        { href: "/account", text: "Account Centre" },
      ]}
    />
  );
}
