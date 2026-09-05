import type { Metadata } from "next";

import Frame from "@/components/site/Frame";
import frame from "@/components/site/Frame.module.css";
import Panel from "@/components/site/Panel";
import TitleBox from "@/components/site/TitleBox";
import { STAFF_CONTACT } from "@/lib/site";

export const metadata: Metadata = {
  title: "Message Centre",
  description: "Messages from the Zanaris staff. Not open yet.",
};

/**
 * A placeholder, so the title screen's Secure Services tile leads somewhere
 * honest. Part 3 replaces this page with the real inbox: staff notices, ban
 * and mute notices, and two-way tickets.
 */
export default function Messages() {
  return (
    <Frame>
      <TitleBox title="Message Centre" />

      <Panel>
        <p>
          The Message Centre is not open yet. When it is, this is where notices
          from the staff, ban and mute notices, and your own bug reports will
          arrive.
        </p>

        {/* STAFF_CONTACT still points here, because no contact link has been
            supplied yet (see the TODO in lib/site.ts). Sending the reader in a
            circle would be worse than saying so; the moment the constant names
            somewhere real, this page links to it like every other page does. */}
        {STAFF_CONTACT.href === "/messages" ? (
          <p>
            In the meantime there is no other way to reach us in writing — a
            contact link will be published here.
          </p>
        ) : (
          <p>
            In the meantime, reach the staff via{" "}
            <a href={STAFF_CONTACT.href} className={frame.link}>
              {STAFF_CONTACT.label}
            </a>
            .
          </p>
        )}

        <p>Remember: staff will never ask for your password.</p>
      </Panel>
    </Frame>
  );
}
