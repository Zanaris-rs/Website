---
title: Lifting a ban or a mute
---

<!-- Sources: components/staff/StaffReportDetail.tsx (when the lift panels
     appear, and the panel about a punishment with no row),
     components/staff/StaffLiftForm.tsx and lib/staff/queries.ts
     (accounts.staff_lift takes one punishment id), lib/staff/format.ts
     (PUBLIC_NOTE_MAX = 120), lib/public/format.ts (the "Lifted" cell) and
     app/bans/page.tsx (revalidate = 300). -->

**There is no in-game unban.** No command undoes a ban or a mute, and
`::ban … 0` is not one — it ends the punishment but leaves the player a notice
saying they are banned and the record a row nobody lifted.

### On the website

Open the report against that player: `/staff/reports`, then the report. When
the account is under a punishment that is still in force, the report page grows
a **Lift the ban** panel, a **Lift the mute** panel, or both.

Each form takes an optional public note and **your password, typed again**. The
password is compared by the database against your own stored hash, so a stolen
session is not enough to lift a punishment in your name.

Three things to know about what it does:

- **It lifts one punishment, not the account.** A player who is both banned and
  muted has two panels, and lifting one leaves the other standing. That is
  usually what you want; when it is not, use both.
- **The row is not deleted and cannot be.** It stays on `/bans` and now says
  when it was lifted. A record that loses the entries somebody changed their
  mind about is not a record.
- **The note is public.** Same 120 characters, same rule as any other public
  note: about the offence, never about the person.

`/bans` is rebuilt every five minutes, so "Lifted *&lt;date&gt;*" appears there within
five minutes rather than instantly. Nothing is wrong if it has not shown up
yet.

### When there is no form

The forms live **on a report**, so an account nobody has ever reported has no
page to lift from. That one is the operator's.

So is a punishment issued **before the public record existed**: there is no row
to lift, and the report page says so in place of a form. The ban is cleared in
the database and the record stamped by hand, both by the operator.

The same is true when this website is down. The operator has a command-line
lift that does the same two things in one statement, and that is the route when
the site cannot be reached. Ask; do not improvise with `::ban`.

### Deciding

Lift when you believe the ban was wrong, or when you have decided the appeal in
the player's favour. Say so in the ticket, close it, and let the public note
carry the short version.

A punishment that has already expired was not lifted by anybody, and stamping
it would make the page say a moderator did something they did not do. Leave it.
