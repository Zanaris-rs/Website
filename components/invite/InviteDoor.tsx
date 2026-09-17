import account from "@/components/account/Account.module.css";
import Panel from "@/components/site/Panel";
import TitleBox from "@/components/site/TitleBox";
import frame from "@/components/site/Frame.module.css";
import { SITE_NAME } from "@/lib/site";

/**
 * What anybody without a working invite sees.
 *
 * There is no waiting list and no form to ask for a place: the only way in is
 * a link from somebody who already plays. The box below takes a pasted code
 * for the people who were sent one in a message rather than as a link. It is a
 * plain GET form to `/join`, so this page needs no script at all.
 */
export default function InviteDoor({ message }: { message?: string | null }) {
  return (
    <>
      <TitleBox title="Invite only" />

      <Panel align="left">
        <div className={account.form}>
          <div className={account.heading}>
            <b>{SITE_NAME} is invite-only</b>
          </div>

          {message ? (
            <p className={account.error} role="alert">
              {message}
            </p>
          ) : null}

          <p>
            You can&apos;t sign up here on your own. Every account on{" "}
            {SITE_NAME} was let in by somebody who already plays, with a link
            that works once.
          </p>
          <p>If you were sent a link, open it. If you were sent a code, paste it here:</p>

          <form method="get" action="/join">
            <div className={account.fields}>
              <label htmlFor="invite-code">Invite code:</label>
              <input
                id="invite-code"
                type="text"
                name="code"
                autoComplete="off"
                spellCheck={false}
                placeholder="XXXX-XXXX-XXXX-XXXX"
                maxLength={32}
                required
              />
            </div>
            <div className={account.actions}>
              <button className={account.submit} type="submit">
                Use this invite
              </button>
            </div>
          </form>

          <p className={account.note}>
            Already have an account?{" "}
            <a className={frame.link} href="/account/login">
              Log in
            </a>{" "}
            or{" "}
            <a className={frame.link} href="/serverlist">
              choose a world
            </a>
            .
          </p>
        </div>
      </Panel>
    </>
  );
}
