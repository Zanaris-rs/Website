---
title: Tickets, appeals and notices
---

<!-- Sources: lib/messages/format.ts and lib/account/message-centre-contract.json
     (the three ticket kinds and their labels; subject 120, body 4000, 5
     tickets per account per day, 20 replies per account per hour, 20 notices
     per actor per hour), lib/staff/queries.ts (staff_inbox's ?status=, and
     staff_reply's close flag), components/staff/StaffReplyForm.tsx,
     StaffNoticeForm.tsx and app/staff/notice/page.tsx (the re-typed password
     and its own throttle bucket), engine MessageCentre.ts (what the ban
     notice tells the player to do). -->

Players cannot email you and there is no chat channel to staff. Everything they
write to you arrives as a **ticket** in the Message Centre, and everything you
write back lands in theirs.

### The three kinds

| Kind | What it is for |
| --- | --- |
| **Bug report** | something in the game is broken |
| **Ban appeal** | the kind every ban notice tells them to open |
| **Something else** | everything the other two are not |

### The inbox

`/staff` lists every ticket, most recently active first. `?status=open`,
`?status=closed` and `?status=all` are plain links, so your back button works
and you can send somebody "the closed ones".

The column that matters is **Awaiting staff** — the newest message on the
ticket is the player's — and the count of those is printed at the top. The list
does not reorder itself between visits.

### Replying

Open a ticket, write, and tick **close** if you are finished with it. A reply
lands in that player's Message Centre and raises the unread count on their next
login, so they will see it in the game whether or not they think to come back
to the site.

A closed ticket refuses an ordinary reply, from you and from them alike. The
close box is also what lets you write on one anyway — the last word on the way
out, or re-closing one somebody reopened.

Their caps, not yours: a player may open **5 tickets a day** and post **20
replies an hour**. Somebody who says they cannot write to you may simply have
run out for the day.

### Notices

`/staff/notice` writes a message straight into a player's Message Centre, with
your name on it, without there being a ticket at all. Use it when a player
should be told something and there is nothing to reply to — after a ban, most
often.

- **You type your password again.** This is the one form on the site that asks
  a signed-in moderator to do that, because it writes in your name into
  somebody else's inbox. The database compares it against your own stored hash.
- **A subject is at most 120 characters and a body 4,000.**
- **Twenty notices an hour**, counted per moderator.
- **Wrong passwords throttle this form, not your login.** Ten fat-fingered
  notices will not lock you out of signing in.

### The appeal flow

1. The ban notice tells the player to open an **appeal** ticket and say what
   they were doing.
2. It arrives in `/staff`, marked as awaiting staff.
3. Read it against the evidence, not against the verdict line — the report and
   its evidence are both still there while the 30 days last.
4. Decide. If you are granting it, **lift the punishment first** (see
   *Lifting*), then reply saying what you did, then close the ticket.
5. If you are refusing it, say why in one sentence a person can act on, and
   close it.

An appeal you cannot decide is one to hand on, not one to leave sitting.

### Repeat offences

Our rule of thumb, and it is a rule of thumb rather than anything the code
enforces: **two lifted bans is generosity, and a third offence is permanent.**
A player who has twice been given the benefit of the doubt and comes back a
third time is telling you something. Check the public record on `/bans` for
their name before you decide a long ban — it is the one page that remembers
everything.
