---
title: Automatic bans
---

<!-- Sources: engine ReportAbuseHandler.ts (a reason outside the enum →
     notifyPlayerBan('automated', …, +172800000) = 2 days),
     MessagePrivateHandler.ts (a private message to a name that decodes to
     invalid_name → the same ban), MessageCentre.ts (AUTOMATED_ACTOR, the
     notice saying "an automated check", the punishment row written with
     automated = true and no issuer) and lib/public/format.ts (issuerLabel). -->

The game bans an account **for two days** on its own, with nobody's name
against it, in exactly two situations:

- a **Report Abuse packet carrying a reason code that is not one of the
  twelve**; and
- a **private message addressed to a name the game cannot decode**.

Neither is something the 2004 client can produce by accident. A player pressing
buttons cannot send a thirteenth reason or a message to an impossible name — a
modified client can, and that is what these two catch.

### What it looks like afterwards

- The notice in the player's Message Centre says they were banned by **"an
  automated check"** rather than by a person, because there is no person.
- The public record on `/bans` says **"Automated"** in the "Issued by" column.
- The ban is 48 hours from the moment it fired, and it expires on its own.

### If they appeal

Read it like any other appeal. These bans are not infallible: they say a client
sent something a normal client cannot, which is strong, but the player may not
be the one who modified it and may not know what they are running.

If you believe them, **lift it the ordinary way**. The lift form lives on a
report against that account, so it is there when somebody has reported them and
not otherwise — an automated ban on a player nobody reported is the operator's
to lift. Either way, look at what their client was doing and tell them what to
stop using.

Two days is short on purpose. An automated ban is a pause, not a verdict.
