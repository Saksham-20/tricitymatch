# Marketing partner onboarding — runbook

For whoever runs the partner programme (an admin with the `marketing` and `payouts` scopes). Written for launch on **11 October 2026**.

## What a partner goes through

1. **You create the account** — Admin → Marketing Users → Create User.
   - Use **Generate** for a strong temporary password. After you press Create, a panel shows the sign-in details **once**. Press *Copy sign-in details* and send them to the partner yourself (WhatsApp is fine). The password cannot be shown again.
   - The partner also gets a **welcome email** (no password in it) with the four first steps. If the email could not be sent, the panel says so; the account still exists.
2. **They sign in** at `/login` with their email and the temporary password, and land on the partner dashboard. The guide asks them to change the password under *Account & security*.
3. **They work through the checklist** on the dashboard (it ticks itself off from real data):
   1. Read and accept the **Partner Guide** (Partner Guide page, bottom). Until they do, the server refuses to let them generate a code or add a member.
   2. Add **payout details** (UPI or bank, and PAN). Stored encrypted; only ever shown back masked.
   3. Generate a **referral code**.
   4. Share it / add people they know (**Outreach Kit** has copy-ready messages, say/never-say lists and live facts).
4. **They earn** commission on what referred members actually pay; see the guide for the rules and *Rep Payouts* for the monthly run.

## What you see

- Admin → Marketing Users has a **Setup** column per partner: `3 of 4` and what is missing ("No payout details · No code yet"). Chase anyone stuck before the monthly payout run.
- The acceptance is stored on the partner's account (version, time, IP, browser) and in the audit log (`partner_agreement_accepted`).

## Looking after an existing partner

Admin → Marketing Users → the eye icon on a partner opens their page, which has an **Account** panel:

- **Edit details** — fix a typo'd email, name or mobile number. (A wrong email also breaks the partner's own password reset, which goes to that address.) A duplicate email or mobile is refused with a clear message.
- **Set new password** — for a partner who is locked out. *Generate* makes a strong one; you get a one-time panel to copy and send. Setting it signs them out everywhere. The password is never stored in the audit log or emailed.
- **Resend welcome email** — the first-steps mail, without a password.

Deactivating a partner (power icon in the list) asks for confirmation: it blocks their sign-in and switches off **all of their referral codes**; reactivating does not switch the codes back on.

There is no delete: a partner account can only be deactivated (the email stays reserved).

### Moving leads to another partner

Use this when a partner leaves, goes quiet, or someone else is better placed to follow a person up.

- **One lead:** Admin → Leads → *Reassign* on the row, pick an active partner.
- **Everything a partner has open:** on their page, the **Open leads** card → *Move to another partner*. (Deactivating a partner shows the count and points you here; their open leads otherwise sit with nobody.)

What moves, and what never does:

- Only **open** leads (new or contacted) move in bulk. Lost leads stay where they are.
- A lead that **already became a member never moves**. The commission follows the partner who brought them, and the Partner Guide promises credit "does not move afterwards".
- If the new partner already has the same person (same phone or email), that lead is skipped and the result says how many.
- The new partner must be **active**. A signup from a moved lead is credited to the new partner, provided that lead is still within the 60-day window.
- Each move is written to the audit log (`lead_reassigned` / `leads_reassigned`).

### The marketing manager role

A **Marketing Manager** is a partner (own codes, own leads, own commission, same guide) who also gets a **Team** page in the portal: every partner's invited / signed up / paid / revenue / commission / open leads / setup progress side by side, searchable and sortable.

It shows **numbers only**. No member names or contact details, no payout details, and no way to change anything. Admins can open the same page. Create one with *Marketing Manager* in the role dropdown.

## Audit log and exports

- **Admin → Audit log** filters by action, who did it (email or part of it), who it was about (member email or ID) and date range (India days). Filters live in the URL, so a filtered view can be pasted to a colleague. A member's page has an **Audit trail** button that opens the log filtered to them.
- Reading a member's record or moderation history is logged once per admin per member per 5 minutes, not on every page load.
- **Export CSV** on the audit log and on Users has **no row cap**: the file streams in batches, the toast states how many rows were saved, and if the stream breaks part-way the file ends with a `# EXPORT INTERRUPTED` line and the toast says it is incomplete. Every export is itself audited with its row count.

## Changing the guide

The guide text lives in `frontend/src/pages/marketing/MarketingGuide.jsx`. If the **rules or the money terms** change in a way partners must agree to again:

1. Edit the guide.
2. Bump `PARTNER_GUIDE_VERSION` in `backend/constants/partnerProgramme.js` to today's date.
3. Deploy. Every partner is asked to accept again (amber strip on every page, and the server blocks new codes and leads until they do). Typo fixes do **not** need a bump.

The hold period, minimum payout and commission rate quoted in the guide are read live from the payout settings, so changing them in Admin never leaves the guide stale.

## Launch week (11 October)

| When | What |
| --- | --- |
| Now | Create the partner accounts. Send sign-in details. Ask each to finish the four steps. |
| By 9 Oct | Check **Setup** column: everyone should read `4 of 4`. A partner at `3 of 4` with no payout details cannot be paid. |
| 10 Oct | The website banner reads "launches tomorrow, 11 October". Partners can already send the launch message from the Kit. |
| 11 Oct | Banner reads "launches today". The Kit's launch message switches to "launches today". |
| 12 Oct onward | Banner and the Kit's launch message retire themselves (no deploy needed). |

Leads a partner adds by hand are credited if that person signs up within **60 days** and the partner is still active, so adding people before launch is worthwhile.

## Things only the owner can settle

- **TDS.** The guide says commission "may be subject to TDS" and promises to show any deduction on each payout. The payout screen applies whatever rate you set (default **0 = off**). Confirm with your CA whether and at what rate/threshold to deduct, then set it in Admin → Rep Payouts → settings. The guide deliberately quotes no rate.
- **Payout cadence.** The guide promises payouts "once a month, in the first week". Make sure that is a commitment you can keep.
- **Grievance Officer name and `VITE_LEGAL_*`** are still unset; the guide links to the grievance email until a named officer exists.
- **A real mailbox** behind `support@` — the welcome email invites partners to reply to it.
