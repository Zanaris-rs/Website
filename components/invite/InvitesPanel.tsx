import account from "@/components/account/Account.module.css";
import Panel from "@/components/site/Panel";
import TitleBox from "@/components/site/TitleBox";
import { formatCitizen } from "@/lib/invite/format";
import type { Citizen } from "@/lib/invite/queries";
import type { InviteView } from "@/lib/invite/view";

import InviteList from "./InviteList";

export default function InvitesPanel({
  citizen,
  invites,
}: {
  citizen: Citizen;
  invites: readonly InviteView[];
}) {
  return (
    <>
      <TitleBox
        title="Invite links"
        links={[{ href: "/account", text: "Account Centre" }]}
      />

      <Panel align="left">
        <div className={account.form}>
          <div className={account.heading}>
            <b>Citizen {formatCitizen(citizen.citizenNumber)}</b>
          </div>

          {citizen.invitesEnabled ? (
            <p>
              Each link lets exactly one person make an account, and stops
              working after fourteen days. You can hold twenty unused links at
              a time. Whoever you let in is linked to you, so choose people you
              would vouch for.
            </p>
          ) : (
            <p className={account.note}>
              Inviting isn&apos;t enabled for your account.
            </p>
          )}

          <InviteList enabled={citizen.invitesEnabled} invites={invites} />
        </div>
      </Panel>
    </>
  );
}
