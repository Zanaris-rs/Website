---
title: Rules of thumb, and privacy
---

<!-- Sources: the two ops guides (bans-moderator-guide.md and
     macro-moderator-guide.md, "rules of thumb"), components/public/Bans.tsx
     and lib/public/format.ts (the public row carries no name), engine
     MessageCentre.ts (the notice does), components/staff/StaffReportDetail.tsx
     (wealth events are staff-only) and StaffResolveForm.tsx (nothing on the
     website bans anybody). -->

### Reaching for the right tool

- **Kick before you mute, mute before you ban**, for anything that is heat
  rather than harm. A kick writes nothing and often ends it.
- **The website cannot ban anybody.** There is no button here that does. A ban
  is a decision, taken in game with `::ban`, and the site is where the reasons
  and the record live.
- **A ban you cannot explain to the player in one sentence is a ban to think
  about again.** You will have to write that sentence in the notice anyway.
- **When it is genuinely close, watch.** The evidence keeps for 30 days; a
  wrong permanent ban keeps forever, on a page anybody can read.
- **Two independent things beat one strong one.** A single metric at an extreme
  is usually an interface button or a touchscreen; a single angry report is
  usually a fight you have arrived halfway through.
- **Ask them something.** A macro does not answer.

### Passwords

- **Never ask a player for a password.** Not to verify them, not to check
  something, not ever. There is no situation in which staff need one, and
  asking is itself the scam we ban people for.
- **Never share your own**, and never type it anywhere but this site's own
  forms. Staff passwords are reset by the operator and by nobody else.
- The forms that ask you to re-type yours — notices, resolutions, lifts —
  compare it inside the database against your own stored hash. That is why a
  stolen session cannot act in your name, and it is why the prompt is not
  ceremony.

### What is yours to see, and not yours to repeat

You can read things about players that nobody else can: their private tickets,
the private messages they sent, what changed hands in their trades, whether two
accounts logged in from the same address.

- **None of it leaves the site.** Not into a chat server, not into a
  screenshot, not into a reply to a different player. Read it on the page and
  leave it there.
- **Wealth events are staff-only.** They are on no public page and belong on
  none.
- **You never see an address**, only whether two accounts shared one. Anything
  more is the operator's, and there is a reason it needs asking for.
- What a player is entitled to see about their own case is **the notice and the
  public record**. That is the whole of it.

### What is public, and what is not

Every ban and mute leaves two things, and it is worth being clear which is
which:

- **A notice, to that player, with your name on it.** They will read it. Write
  it as if they will.
- **A row on `/bans`, to everybody, without your name on it.** It says "A
  moderator" or "Automated", and no page on this site can turn that into a
  name. Everybody else will read that. Write the public note as if they will.

That pair is the audit trail. It is also the answer to "who banned me" — the
answer is that it does not matter, and the appeal goes through the Message
Centre rather than through whoever they think it was.

### And the one that covers the rest

You are moderating a free rehost that people play for fun. Almost everything
here is recoverable: a kick, a mute, an hour. The two that are not are a
permanent ban and a dismissed report, and both of those deserve the extra
minute.
