import { describe, expect, it } from "vitest";

import type { Punishment } from "./queries";
import {
  endsColour,
  endsLabel,
  flowColour,
  flowSentence,
  formatShortWhen,
  issuerLabel,
  punishmentKindLabel,
  punishmentState,
  signed,
} from "./format";

const NOW = Date.parse("2026-09-05T12:00:00Z");

const punishment = (over: Partial<Punishment> = {}): Punishment => ({
  username: "the_inducted",
  kind: "ban",
  issuedAt: "2026-09-01T10:00:00Z",
  until: null,
  automated: false,
  note: "",
  liftedAt: null,
  ...over,
});

describe("issuerLabel", () => {
  it("says a moderator or automated, and never a name", () => {
    expect(issuerLabel(false)).toBe("A moderator");
    expect(issuerLabel(true)).toBe("Automated");
  });
});

describe("punishmentKindLabel", () => {
  it("names the two kinds", () => {
    expect(punishmentKindLabel("ban")).toBe("Ban");
    expect(punishmentKindLabel("mute")).toBe("Mute");
  });
});

describe("punishmentState", () => {
  it("calls a punishment with no end date permanent", () => {
    expect(punishmentState(punishment(), NOW)).toBe("permanent");
  });

  it("calls one that has not run out active", () => {
    expect(
      punishmentState(punishment({ until: "2026-09-08T10:00:00Z" }), NOW),
    ).toBe("active");
  });

  it("calls one that has run out expired", () => {
    expect(
      punishmentState(punishment({ until: "2026-09-02T10:00:00Z" }), NOW),
    ).toBe("expired");
  });

  it("calls a lifted one lifted, whatever its end date said", () => {
    expect(
      punishmentState(
        punishment({ until: null, liftedAt: "2026-09-03T10:00:00Z" }),
        NOW,
      ),
    ).toBe("lifted");
  });

  it("treats an unreadable end date as permanent rather than as expired", () => {
    expect(punishmentState(punishment({ until: "yesterday" }), NOW)).toBe(
      "permanent",
    );
  });
});

describe("endsLabel", () => {
  it("says Never for a permanent one", () => {
    expect(endsLabel(punishment(), NOW)).toBe("Never");
  });

  it("gives the date for one with an end", () => {
    expect(endsLabel(punishment({ until: "2026-09-08T10:00:00Z" }), NOW)).toBe(
      "8-Sep-2026",
    );
  });

  it("says when it was lifted", () => {
    expect(
      endsLabel(punishment({ liftedAt: "2026-09-03T10:00:00Z" }), NOW),
    ).toBe("Lifted 3-Sep-2026");
  });
});

describe("endsColour", () => {
  it("reddens what is still in force and leaves the rest alone", () => {
    expect(endsColour(punishment(), NOW)).toBe("red");
    expect(endsColour(punishment({ until: "2026-09-08T10:00:00Z" }), NOW)).toBe(
      "red",
    );
    expect(
      endsColour(punishment({ until: "2026-09-02T10:00:00Z" }), NOW),
    ).toBeNull();
    expect(
      endsColour(punishment({ liftedAt: "2026-09-03T10:00:00Z" }), NOW),
    ).toBeNull();
  });
});

describe("formatShortWhen", () => {
  it("is the news list's compact date", () => {
    expect(formatShortWhen("2026-09-08T23:59:00Z")).toBe("8-Sep-2026");
  });

  it("says unknown rather than throwing on a date it cannot read", () => {
    expect(formatShortWhen(null)).toBe("unknown");
    expect(formatShortWhen("")).toBe("unknown");
    expect(formatShortWhen("tomorrow")).toBe("unknown");
  });
});

describe("flowSentence", () => {
  it("says what happened without saying to whom", () => {
    expect(flowSentence(1)).toBe("1 entered the game");
    expect(flowSentence(-2)).toBe("2 left the game");
    expect(flowSentence(12_000)).toBe("12,000 entered the game");
  });
});

describe("signed", () => {
  it("marks the direction and groups the thousands", () => {
    expect(signed(4)).toBe("+4");
    expect(signed(-1200)).toBe("−1,200");
    expect(signed(0)).toBe("0");
  });
});

describe("flowColour", () => {
  it("greens what entered and reddens what left", () => {
    expect(flowColour(3)).toBe("green");
    expect(flowColour(-3)).toBe("red");
    expect(flowColour(0)).toBeNull();
  });
});
