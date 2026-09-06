---
title: Bans and mutes
---

<!-- Sources: engine ClientCheatHandler.ts (`::ban`, `::mute`, the argument
     parsing and the messages), World.ts notifyPlayerBan/notifyPlayerMute,
     MessagePublicHandler.ts and MessagePrivateHandler.ts (what a mute stops),
     LoginServer.ts and MessageCentre.ts (the notice, the punishment row and
     the one-hour rewrite window), the Java client's login messages,
     lib/account/profile.ts (the Account Centre line), lib/public/format.ts
     and components/public/Bans.tsx (the public record), lib/staff/format.ts
     (PUBLIC_NOTE_MAX). -->

Two commands, and they take the same arguments:

```
::ban <username> <minutes>
::mute <username> <minutes>
```

### Getting the name right

The whole line is lower-cased and split on spaces before anything reads it, so
use the account's stored name: lower case, underscores for spaces —
`bob_smith`, not `Bob Smith`.

Because it splits on spaces, `::ban bob smith 60` bans an account called
**`bob`**. It does not ban `bob_smith`, and it does not complain: `smith` is
not a number, so the minutes fall back to 60 and the ban goes through.

The game answers `Player 'bob' has been banned for 60 minutes.` **whether or
not any such account exists.** There is no "no such player" for `::ban` or
`::mute`. If you are not certain of the spelling, type `::kick <username>`
first: kick says `does not exist or is not logged in` when it does not.

### Getting the minutes right

- Minutes that do not parse fall back to **60**. A typo is an hour, not a year.
- A negative number becomes **0**.
- **`0` is not an unban.** It sets the end of the punishment to *now*, which
  ends it, but it also writes a row on the public record and sends the player a
  ban notice saying they are banned until a moment that has already passed.
  Lift it properly — see *Lifting* — and never use `::ban … 0`.
- The new end time **replaces** the old one. Punishments do not add up: banning
  somebody for 10 minutes who had a week left leaves them with 10 minutes.

Durations we use:

| Situation | Minutes |
| --- | --- |
| cool-off, first offence | `60` |
| a day | `1440` |
| a week | `10080` |
| a month | `43200` |
| a year | `525600` |
| permanent | `52560000` |

### What a ban does

If they are online they are logged out and disconnected at once. Until the end
time they cannot log in to the game on any world.

### What a mute does

They keep playing. Nothing they type in public chat reaches anybody, and
neither does any private message they send. **The game does not tell them they
are muted** — the handler simply drops the line. It applies immediately if they
are online, and on their next login if they are not.

Level-1 player moderators do not have `::mute`; they mute through the box on
the Report Abuse screen, which is always 48 hours. See *Report Abuse*.

### There is no reason field

The command line is lower-cased and capped at 80 characters before the handler
sees it, so there is nowhere to put one. If the player should know more than
the notice tells them, send them a notice from `/staff/notice` and keep it
short and factual.

### What the player sees

- **In the game**, at the login screen: "Your account has been disabled. Please
  check your message-centre for details."
- **On this website they can still sign in**, with the same username and
  password. That is deliberate: it is where the explanation is.
- **The Account Centre** says "Banned until *&lt;date&gt;*. You cannot log in to the
  game until then."
- **The Message Centre** holds a notice titled "Your account has been banned
  until *&lt;date&gt; UTC*". It **names you** as the moderator who issued it, and it
  tells them to open a ticket of kind "appeal" and say what they were doing.
  The mute notice is the same shape.
- **The game's welcome screen** shows their unread count in green on their next
  login, which is how they find the notice.
- **The hiscores** hide an account while a ban is in force.
- **`/bans`**, in public, forever: the name, ban or mute, the date it was
  issued, the date it ends, and "A moderator" or "Automated". **Your name is
  never on it**, and no page on this site can produce it. Expired and lifted
  punishments stay on the record with their dates rather than disappearing.

A second ban or mute on the same account **within an hour** rewrites the notice
they have not read yet, rather than adding a second one — one message per
decision, carrying the latest end time and the name of whoever set it. The
public record is not rewritten: it keeps both rows.

### The public note

A punishment can carry a **one-line public note of at most 120 characters**,
shown under it on `/bans`. Today you write one when you lift a punishment (see
*Lifting*); the operator can add one to any row.

It is read by everybody, it is about the offence and never about the person,
and it stays there after the punishment has expired. "Automated macro
detection." or "Real-world trading." is the register. Anything you would not
say to their face in a crowded room does not go in it.
