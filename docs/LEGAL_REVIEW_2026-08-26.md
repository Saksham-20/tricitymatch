# Legal review — Indian law applicable to TricityMatch

**Date:** 26 August 2026
**Scope:** what Indian law requires of a matrimonial platform like this one, what our
published Terms and Privacy Policy said before this pass, the gaps between the two, and
what was changed. Benchmarked against Shaadi.com (People Interactive), Jeevansathi and
BharatMatrimony as the incumbents whose published policies are the de-facto market standard.

Nothing here is legal advice. It is an engineering review of published documents against
published law, done so that a lawyer's time — when you buy it — is spent on the two or three
judgment calls rather than on the twenty obvious omissions.

---

## 1. The law that actually applies to us

| Instrument | Why it binds us | Concrete obligation |
|---|---|---|
| **Information Technology Act, 2000** | We host member-generated content → we are an **intermediary** (s.2(1)(w)); safe harbour under s.79 is conditional on due diligence | Publish rules of use; act on unlawful content; assist agencies |
| **IT (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021** | Applies to every intermediary, not only large ones | r.3(1)(a) publish T&C + privacy policy; **r.3(1)(b) publish the enumerated list of content users may not host**; r.3(1)(c)+(f) inform users **at least once a year** of the rules and of changes; r.3(1)(d) act on court/government order within **36 hours**; r.3(1)(h) **retain registration information 180 days after deletion**; r.3(1)(j) preserve removed content **180 days**; r.3(2)(a) **publish the Grievance Officer's name and contact**, acknowledge within **24 hours**, decide within **15 days**; r.3(2)(b) act within **24 hours** on complaints about nudity / sexual acts / impersonation incl. morphed images |
| **Digital Personal Data Protection Act, 2023 + DPDP Rules, 2025** (Rules notified 13 Nov 2025, phased, full compliance by 13 May 2027) | We are a **Data Fiduciary** | Consent notice that stands alone and gives an **itemised** description of the data and the purpose; withdrawal **as easy as giving**; publish the contact for data queries and the **grievance response timeline** (r.14(3)); rights of access / correction / erasure / **nomination**; breach notice to the Board without delay and a full account within **72 hours**; erase when purpose is served |
| **IT (Reasonable Security Practices … SPDI) Rules, 2011** | Still in force alongside DPDP until s.43A is omitted (expected with the DPDP transition, ~May 2027) | Publish a privacy policy; obtain consent for sensitive personal data; reasonable security practices |
| **CERT-In Directions, 2022 (28 Jun 2022)** | Applies to every "body corporate" | Report cyber incidents (incl. data breach) within **6 hours**; enable logs and retain them **180 days** *within Indian jurisdiction* |
| **Consumer Protection Act, 2019 + Consumer Protection (E-Commerce) Rules, 2020** | We sell memberships online | Display **legal name, head-office address, customer-care and grievance-officer name/contact/designation**; acknowledge a consumer complaint within **48 hours**, redress within **one month**; no unfair trade practice; consumer's home-forum right cannot be contracted away |
| **CCPA Guidelines for Prevention and Regulation of Dark Patterns, 2023** | Applies to any platform selling to consumers | 13 named patterns prohibited — for us the live ones are **false urgency** (a fake offer deadline), **drip pricing** (a price that grows after checkout), **subscription trap** (hard-to-cancel) and **confirm-shaming** |
| **Prohibition of Child Marriage Act, 2006** | We are in the business of facilitating marriage | Legal marriageable age is **21 for men, 18 for women**. The 2021 amendment bill raising women to 21 **lapsed and is not law** |
| **Dowry Prohibition Act, 1961** | Matrimonial context | Demanding dowry is an offence; a platform should prohibit and act on it |
| **MeitY advisory to matrimonial websites (2016)** | Sector-specific, advisory not statutory | Declare the site is **for matrimony, not dating**; caution users about fraud; publish grievance-officer contact; verify users against a listed ID; retain the profile creator's IP address for up to a year after deactivation |
| **Aadhaar Act, s.57 struck down (*Puttaswamy*)** | Relevant to what we must NOT do | A private platform **cannot** require Aadhaar authentication. Our selfie-only verification is on the right side of this — do not "improve" it by collecting Aadhaar |

---

## 2. What the incumbents publish (benchmark)

Read live on 26 Aug 2026: `shaadi.com/info/terms`, `shaadi.com/info/privacy`.

- **Age stated correctly**: "21 years or above for males and 18 years or above for females."
- **Grievance Officer named** — a natural person (Shairish Shaikh) with a postal address, plus a
  separate named **Data Protection Officer**. Not a role mailbox.
- **Explicit "not a dating site"** clause: prohibits "casual dating, companionship, immoral,
  illegal, exploitative, or commercial solicitation."
- **Verification disclaimer**: mobile-number verification "shall not be construed as authentication
  or assurance of the Member's genuineness, character, intent, or compatibility."
- **Liability capped** at fees actually paid; full indemnity clause; exclusive Mumbai jurisdiction.
- **Wind-down promise**: 50% of the unused portion refunded pro-rata if they cease operating.
- **Chat auto-deleted after 90 days.**
- Privacy policy has dedicated sections for **Cross-Border Data Transfers**, **Automated
  Decision-Making and Profiling**, **How to Exercise Your Rights** and **Child Safety**.
- Their content licence is aggressive (perpetual, irrevocable, sublicensable, derivative works).
  We deliberately did **not** copy that — see §4.

---

## 3. Gaps found

Severity: 🔴 legal exposure or a false published statement · 🟠 required disclosure missing ·
🟡 weak but defensible.

### Terms of Service (before this pass)

| # | Gap | Severity |
|---|---|---|
| T-1 | **Minimum age stated as 18 for everyone.** Indian law is 21 for men. We were publishing an eligibility rule that facilitates a marriage the state treats as voidable, in the one business where age is the load-bearing fact | 🔴 |
| T-2 | **"Fees are non-refundable except where required by law"** — flatly contradicted by `/refund-policy`, which promises a seven-day no-questions refund. Two live published documents, opposite terms. In a dispute the consumer-favourable one binds, so the Terms bought us nothing and cost us credibility | 🔴 |
| T-3 | **No r.3(1)(b) prohibited-content list.** The nine enumerated categories are what an intermediary must publish to keep s.79 safe harbour. We had a short "acceptable use" list of our own words instead | 🔴 |
| T-4 | **Grievance Officer not named**, only `grievance@`. r.3(2)(a) requires the name and contact of a natural person, and the E-Commerce Rules require a designation too | 🔴 |
| T-5 | **No legal entity, no address.** E-Commerce Rules r.4(3)/5(3) require the legal name and head-office address to be displayed. Neither appeared anywhere on the site | 🔴 |
| T-6 | **No stated grievance timelines** — "within the timelines prescribed by law" is not a published timeline. 24h ack / 15-day decision / 36h on official order / 24h on intimate-imagery and impersonation, and 48h/1-month for consumer complaints, all had to be stated | 🟠 |
| T-7 | **No "matrimonial purpose only, not a dating site" declaration** (MeitY advisory; every incumbent has one) | 🟠 |
| T-8 | **No annual re-notification commitment** (r.3(1)(c)/(f)) | 🟠 |
| T-9 | **No marital-status truthfulness clause** — the single most common matrimonial fraud is a married person registering, and nothing addressed it | 🟠 |
| T-10 | **No dowry clause.** Matrimonial platform, no mention of the Dowry Prohibition Act | 🟠 |
| T-11 | **No liability cap, no indemnity, no severability / assignment / entire-agreement / force majeure.** The limitation clause excluded indirect loss but left direct liability uncapped | 🟠 |
| T-12 | **Post-deletion retention not stated** — and cannot be omitted, because r.3(1)(h) makes us keep registration data 180 days | 🟠 |
| T-13 | **Chandigarh exclusive jurisdiction with no consumer carve-out.** A consumer's right to file where they live cannot be contracted away; an unqualified clause is itself an unfair term | 🟡 |
| T-14 | **Content licence too thin to cover what we actually do** (resize, transcode, show to a linked guardian) while also not stating the limits we want to keep | 🟡 |
| T-15 | **No GST / tax-inclusive statement**, no invoice availability, no statement that a promotional strike-through is a real prior price (dark-patterns exposure: drip pricing, false urgency) | 🟡 |

### Privacy Policy (before this pass)

| # | Gap | Severity |
|---|---|---|
| P-1 | **"Permanently purged" was false in two directions.** `backend/utils/accountErasure.js` deliberately retains subscriptions, unlock purchases and reports, and r.3(1)(h) forces 180-day retention of registration data. The policy described neither | 🔴 |
| P-2 | **Breach reporting named only the Data Protection Board.** CERT-In's 6-hour reporting duty applies to us and was unmentioned; the DPDP 72-hour detailed report was unmentioned | 🔴 |
| P-3 | **No cross-border transfer disclosure**, while image hosting and email delivery run outside India | 🟠 |
| P-4 | **No automated-processing / profiling section**, while we run compatibility scoring, Ashtakoot, numerology, a daily match set, paid-boost ranking and photoless-profile demotion | 🟠 |
| P-5 | **Marketing and lifecycle mail undisclosed.** We now send abandoned-checkout, win-back, expiry, digest and nudge mail. No disclosure, no stated opt-out, no separation from service mail | 🟠 |
| P-6 | **Rights section had no mechanism and no timeline.** DPDP Rules r.14(3) requires a published timeline; "the timelines prescribed by law" is not one | 🟠 |
| P-7 | **Sensitive categories never named.** Caste, religion, horoscope, income and the selfie are the sensitive fields; SPDI Rules require consent specifically for them | 🟠 |
| P-8 | **Guardian-created profiles**: the candidate is a data principal whose data is processed on someone else's say-so. The policy said nothing about their notice, access or override rights | 🟠 |
| P-9 | **Processors not named** — "our email/SMS providers" is not an itemised disclosure | 🟠 |
| P-10 | **No escalation route** to the Data Protection Board | 🟠 |
| P-11 | **Data collected was under-described** vs what the schema holds: no mention of horoscope fields, voice/video intros, blocks/reports, call metadata, push tokens, guardian links, audit trail or product counters | 🟠 |
| P-12 | **Calls not addressed at all** — members reasonably want to know whether in-app calls are recorded | 🟡 |
| P-13 | **Chat retention undefined.** Shaadi deletes chat after 90 days; we keep it indefinitely and said nothing | 🟡 |
| P-14 | **Success stories** publish a member's name and photo publicly; no consent/withdrawal statement | 🟡 |

---

## 4. What changed in this pass

**Rewritten:** `frontend/src/pages/Terms.jsx`, `frontend/src/pages/Privacy.jsx`, and their mobile
mirrors `mobile/src/features/legal/TermsScreen.tsx` / `PrivacyScreen.tsx`.

Terms went from 15 thin clauses to 24, closing T-1 … T-15. Notable positions taken:

- **Age set at 21 men / 18 women**, with a truthful-marital-status declaration and a prohibited-
  degrees clause.
- **Refund contradiction removed** — clause 13 now incorporates `/refund-policy` by reference
  instead of contradicting it, and says plainly that nothing limits Consumer Protection Act rights.
- **r.3(1)(b) list published verbatim in substance**, plus the annual re-notification promise.
- **Liability capped** at amounts paid in the preceding twelve months (₹1,000 floor if nothing was
  paid), with carve-outs for fraud and consumer rights.
- **Content licence widened only to what we do** — host, store, reproduce, resize, adapt for display,
  show to members and linked guardians — and explicitly **non-perpetual and non-sublicensable**,
  ending on deletion. We are not taking Shaadi's perpetual irrevocable derivative-works licence over
  a member's wedding photographs; a small local platform's credibility is worth more than that
  licence is.
- **Consumer carve-out** on the Chandigarh jurisdiction clause, with NCH 1915 / e-Daakhil named.
- Dowry, no-money-requests, no-scraping and one-account-per-person clauses added.

Privacy went from 12 sections to 17, closing P-1 … P-14. Notable positions:

- **Section 13 describes erasure exactly as the code performs it** — erased / message-text-destroyed /
  retained (financial + moderation) / 180-day registration hold / 180-day preservation of removed
  content — because a deletion promise that the database does not keep is the worst kind of false
  statement to publish.
- **CERT-In 6 hours and DPDP 72 hours both stated**, along with what a breach notice to you contains.
- Named processors, cross-border paragraph, automated-matching section, marketing opt-out section,
  guardian-override section, sensitive-category paragraph, 30-day rights-response commitment,
  24h/15-day grievance commitment, Data Protection Board escalation, "we do not record calls".

**New config, both platforms:** `frontend/src/config/index.js → legal` and
`mobile/src/constants/config.ts → CONFIG.LEGAL_*`. Entity name, address, GSTIN, Grievance Officer
name, DPO name, grievance/privacy mailboxes and one shared "last updated" date. Same doctrine as the
existing support channels: **a value we do not have is omitted, never rendered as a placeholder.**
A fabricated Grievance Officer is a false statutory disclosure, which is worse than a missing one.

---

## 5. Still open — owner decisions and code work

These are **not** fixed by this pass. Ranked.

### Owner facts (nothing can be published until you supply them)

1. 🔴 **Registered legal name + head-office address.** Required to be displayed by the E-Commerce
   Rules. Set `VITE_LEGAL_ENTITY` / `VITE_LEGAL_ADDRESS` (and the `EXPO_PUBLIC_` twins). Until set,
   the pages read "TricityMatch" with no address — legible, but non-compliant.
2. 🔴 **Name a Grievance Officer** (a real person resident in India — it can be you) and set
   `VITE_GRIEVANCE_OFFICER`. IT Rules require the name, not a mailbox.
3. 🔴 **A mailbox somebody reads** behind `grievance@` and `privacy@`. Both are asserted in two
   published policies and on two app stores. Today neither has inbound routing — Resend is
   send-only. A published grievance address that bounces is worse than none.
4. 🟠 **GSTIN**, once registered, and confirmation that displayed prices are tax-inclusive (the
   Terms now state they are).
5. 🟠 **Set the real launch-offer deadline** in Admin → Pricing & Offers. A countdown to a date
   chosen for effect is *false urgency* under the CCPA dark-patterns guidelines — the one dark
   pattern this product is actually exposed to.

### Code follow-ups

6. 🔴 **Age gate does not match the Terms.** `backend/validators/index.js` rejects under-18 for
   everyone; the Terms now correctly say 21 for men. Either enforce gender-aware minimum age at
   signup and in profile edit, or the published term is one we knowingly do not apply. Enforcing it
   is a ~10-line validator change plus a message; the product decision is yours.
7. 🟠 **Annual re-notification is promised but not built.** Needs a yearly job that emails members
   the Terms/Privacy reminder (r.3(1)(c)/(f)). The lifecycle-mail machinery from the 25 Aug pass can
   carry it.
8. 🟠 **180-day registration-data retention is stated but not implemented.** `eraseAccount()` erases
   immediately. The IT Rules make retention a *duty*, not an option — today we under-retain, which
   is a safe-harbour argument we would rather not have to make. A tombstone row carrying only the
   registration identifiers, purged by a scheduled job at day 180, satisfies both this and DPDP.
9. 🟠 **CERT-In log retention "within Indian jurisdiction."** Docker log rotation exists (18 Aug
   pass); confirm the retention window reaches 180 days and that the host is in India.
10. 🟡 **Chat retention.** We keep messages forever. Consider a stated retention window; if you
    choose one, put it in Privacy §13 and build the purge in the same commit.
11. 🟡 **In-product consent record.** Signup shows a Terms checkbox; storing the version accepted and
    the timestamp turns "they agreed" into evidence, and is what DPDP consent record-keeping expects.
12. 🟡 **Guardian notice to the candidate.** The Terms now require the guardian to have consent; the
    product does not verify it. An email/SMS to the candidate at profile creation ("a profile has
    been created for you — here is how to take control of it") would close the gap that matters most
    in a matrimonial context, where the person being listed is often the last to know.
13. 🟡 **Wind-down promise.** Shaadi commits to refunding 50% of the unused term pro-rata if it
    ceases operating. For a 15-member platform selling 90-day memberships, saying something here
    would materially reduce a family's perceived risk. Currently we say nothing.

---

## Sources

Read on 26 August 2026.

- [DPDP Rules, 2025 — notification (PIB)](https://static.pib.gov.in/WriteReadData/specificdocs/documents/2025/nov/doc20251117695301.pdf) · [EY compliance guide](https://www.ey.com/en_in/insights/cybersecurity/transforming-data-privacy-digital-personal-data-protection-rules-2025) · [Rule 3 — notice](https://www.dpdpa.com/dpdparules/rule3.html) · [Rule 14 — rights](https://www.dpdpa.com/dpdparules/rule14.html)
- [IT (Intermediary Guidelines) Rules, 2021 — s.3(1) text](https://indiankanoon.org/doc/45988656/) · [Trilegal summary](https://trilegal.com/wp-content/uploads/2021/11/Information-Technology-Rules-2021.pdf) · [PRS overview](https://prsindia.org/billtrack/the-information-technology-intermediary-guidelines-and-digital-media-ethics-code-rules-2021)
- [CERT-In Directions, 2022 — Trilegal](https://trilegal.com/wp-content/uploads/2022/05/2022-CERT-In-Directions-on-Reporting-Cyber-Incidents-1.pdf)
- [SPDI Rules status after DPDP](https://opsiocloud.com/in/knowledge-base/are-spdi-rules-still-in-force/)
- [Consumer Protection (E-Commerce) Rules, 2020 (ICSI text)](https://www.icsi.edu/media/webmodules/Consumer_Protection_E-Commerce_Rules_2020.pdf) · [Khaitan & Co summary](https://www.khaitanco.com/thought-leaderships/Stricter-Regulations-on-E-Commerce-The-Consumer-Protection-E-Commerce-Rules-2020)
- [Dark Patterns Guidelines, 2023 (PIB)](https://pib.gov.in/PressReleasePage.aspx?PRID=1983994) · [CCPA self-audit advisory](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2134765)
- [Legal marriage age in India, 2026](https://vakilsearch.com/article/legal-age-for-marriage-in-india/) · [Amendment Bill status](https://en.wikipedia.org/wiki/Prohibition_of_Child_Marriage_(Amendment)_Bill,_2021)
- [MeitY advisory to matrimonial websites — MediaNama](https://www.medianama.com/2016/06/223-government-matrimonial-sites-id-proof/) · [India TV](https://www.indiatvnews.com/news/india-user-verification-with-valid-ids-must-on-matrimonial-sites-govt-advisory-332427)
- [Aadhaar s.57 / commercial use](https://www.nationalheraldindia.com/india/violating-sc-rules-matrimonial-site-sells-love-marriage-using-aadhaar-data)
- Benchmark: [Shaadi.com Terms](https://www.shaadi.com/info/terms) · [Shaadi.com Privacy](https://www.shaadi.com/info/privacy)
