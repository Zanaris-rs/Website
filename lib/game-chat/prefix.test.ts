import { describe, expect, it } from "vitest";

import { chatPrefix, parseChatPrefix } from "./prefix";

describe("parseChatPrefix (Client.ts, sending public chat)", () => {
  it("reads a colour, then an effect", () => {
    expect(parseChatPrefix("glow1:wave:Selling lobbies")).toEqual({ colour: 9, effect: 1, text: "Selling lobbies" });
    expect(parseChatPrefix("scroll:hi")).toEqual({ colour: 0, effect: 2, text: "hi" });
    expect(parseChatPrefix("plain")).toEqual({ colour: 0, effect: 0, text: "plain" });
  });
  it("checks the colours once each, in the client's order", () => {
    // red is checked before green, so both strip; the reverse leaves one
    expect(parseChatPrefix("red:green:hi")).toEqual({ colour: 2, effect: 0, text: "hi" });
    expect(parseChatPrefix("green:red:hi")).toEqual({ colour: 2, effect: 0, text: "red:hi" });
    expect(parseChatPrefix("wave:red:hi")).toEqual({ colour: 0, effect: 1, text: "red:hi" });
  });
  it("is case-sensitive, as the client is", () => {
    expect(parseChatPrefix("Red:hi")).toEqual({ colour: 0, effect: 0, text: "Red:hi" });
  });
});

describe("chatPrefix", () => {
  it("prints what parseChatPrefix reads back", () => {
    for (let colour = 0; colour < 12; colour++) {
      for (let effect = 0; effect < 3; effect++) {
        const parsed = parseChatPrefix(`${chatPrefix(colour, effect)}x`);
        expect([parsed.colour, parsed.effect, parsed.text]).toEqual([colour, effect, "x"]);
      }
    }
    expect(chatPrefix(0, 0)).toBe("");
  });
});
