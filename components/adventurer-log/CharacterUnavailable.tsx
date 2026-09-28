import Frame from "@/components/site/Frame";
import Panel from "@/components/site/Panel";
import TitleBox from "@/components/site/TitleBox";

/** What a Character page shows when its reads fail. */
export default function CharacterUnavailable() {
  return (
    <Frame>
      <TitleBox title="Character" links={[{ href: "/account", text: "Account Centre" }]} />
      <Panel>
        <p>Your character is unavailable right now. Try again shortly.</p>
      </Panel>
    </Frame>
  );
}
