"use client";

import { tables } from "@/lib/chathead/load";
import type { Look } from "@/lib/chathead/look";
import { defaultLook } from "@/lib/chathead/validate";

import Chathead from "./Chathead";

/**
 * A chathead cut down to the face, for a small picture beside a post or a
 * reply: the frame is tall enough for the tallest hats, and at avatar size
 * that leaves the face a dot. The window is centred on the head's origin, a
 * little above it, and anything outside it (a hat's point) is cut off.
 *
 * A player who has never saved an outfit has no look; they get the game's
 * new-character face (`defaultLook(0)`) rather than an empty box.
 */
const FALLBACK: Look = defaultLook(0);

export default function ChatheadFace({
  look,
  size = 64,
  label,
  className,
}: {
  look: Look | null;
  size?: number;
  label?: string;
  className?: string;
}) {
  const { originX, originY } = tables.frame;
  // The face spans roughly 64 frame pixels; scale it to fill `size`.
  const scale = size / 72;
  return (
    <span
      className={className}
      style={{
        display: "inline-block",
        position: "relative",
        width: size,
        height: size,
        overflow: "hidden",
        verticalAlign: "top",
      }}
    >
      <span
        style={{
          position: "absolute",
          left: size / 2 - originX * scale,
          top: size * 0.62 - originY * scale,
        }}
      >
        <Chathead look={look ?? FALLBACK} scale={scale} label={label} />
      </span>
    </span>
  );
}
