import type { Metadata } from "next";
import { notFound } from "next/navigation";

import ChatText from "@/components/game/ChatText";
import Frame from "@/components/site/Frame";
import Panel from "@/components/site/Panel";
import TitleBox from "@/components/site/TitleBox";
import { CHAT_COLOUR_NAMES, CHAT_EFFECT_NAMES } from "@/lib/game-chat/effects";

import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Chat text gallery",
  robots: { index: false },
};

const SAMPLE = "Like this";

/**
 * Every chat colour x effect drawn by `<ChatText>`, plus the p12 font and a
 * scaled-up sample - the check that both fonts load and every colour cycle
 * and both effects animate on a real page, after a regeneration or a change
 * to `lib/game-chat/`. Development only - production answers 404.
 */
export default function ChatTextGallery() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <Frame>
      <TitleBox title="Chat text gallery" />
      <Panel width="100%">
        <p>
          Every chat colour (<code>CHAT_COLOUR_NAMES</code>) across every effect (
          <code>CHAT_EFFECT_NAMES</code>), drawn by <code>&lt;ChatText&gt;</code> in the b12 font.
        </p>
        <table cellPadding={6} style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>Colour</th>
              {CHAT_EFFECT_NAMES.map((name) => (
                <th key={name} style={{ textAlign: "left" }}>
                  {name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CHAT_COLOUR_NAMES.map((name, colour) => (
              <tr key={name}>
                <td>{name}</td>
                {CHAT_EFFECT_NAMES.map((effectName, effect) => (
                  <td key={effectName}>
                    <ChatText text={SAMPLE} colour={colour} effect={effect} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        <p style={{ fontFamily: '"Zanaris p12", Arial, sans-serif', fontSize: 12, color: "#fff" }}>
          p12: The quick brown fox jumps over the lazy dog. 0123456789
        </p>

        <p>One line at 2x, so the pixels are easy to check by eye:</p>
        <p>
          <ChatText text={SAMPLE} colour={9} effect={1} className={styles.big} />
        </p>
      </Panel>
    </Frame>
  );
}
