---
name: feature-interrogation
description: Interrogate a product feature the way a curious member, a professional developer and an operator would, trace each question to the real code, and write down every gap, bug and open decision as an evidence-backed finding. Report-only. Use when asked to "go through every feature", "ask the questions a user or dev would ask", pre-launch readiness sweeps, or when a feature feels done but nobody has challenged it.
---

# Feature interrogation

A feature is not done when it works on the happy path. It is done when the questions
people will actually ask have answers that hold up. This skill is a repeatable way of
asking those questions, answering them **from the code and the running system rather
than from documentation**, and writing down whatever does not hold up.

It exists because of how real defects were found in this project: a member asked "can
I hide my phone number?" and the honest answer was that two privacy columns existed
and nothing read them; a developer asked "what happens if two taps arrive at once?" and
a quota counter was being overspent; an operator asked "can I see who got a refund?"
and receipts were being issued for orders nobody paid. None of those came from a test
suite. All came from asking the next question.

## Ground rules

1. **Report only.** Do not edit source, run migrations, restart services, commit or
   deploy. The output is a list. Fixing is a separate decision made by the owner.
2. **Code beats docs.** `CLAUDE.md`, comments and READMEs have been wrong here before
   (a stale comment gutted a working feature; a doc claimed columns that were never
   created). Read the code that executes. Quote `file:line`. If you cannot find it, say
   `UNKNOWN`, never guess.
3. **Run it when running is cheap.** A unit test, a `SELECT` against the dev database,
   or a `curl` against a local instance settles an argument that reading cannot.
   A debug server that has been running for hours may be serving OLD code: start your
   own copy on a spare port rather than trusting it.
4. **Never cause side effects.** No real SMS, email, push or payment. The dev
   environment shares production's Resend key and live MSG91 key. No production access
   of any kind (no SSH, no prod URLs with writes). Dev database: `SELECT` freely; if a
   probe must write, use a throwaway row and delete it. Never touch another tenant on
   the shared VPS.
5. **One question, one verdict.** Do not let a vague "seems fine" stand. Every question
   ends in exactly one verdict (below), with evidence.
6. **Do not pad.** A short list of real findings beats a long list of nitpicks. If a
   feature is solid, say so in one line and move on.

## The method

For each feature in scope:

### 1. Establish what it really does
Find the entry points (route, page, job, socket event) and trace one full path:
UI → API route → middleware → controller → model → side effects (email, notification,
cache, queue) → what the user sees next. Note every gate (auth, plan, block, visibility,
rate limit, feature flag) and every place a value is computed or stored.

### 2. Ask the questions, in four voices

**The member** (non-technical; also the parent and the elder using this for a child):
- Can I find it? Do I understand what it will do before I press it? What does it cost me?
- What did it just do? Is there a confirmation, a receipt, an undo?
- What if I change my mind, make a typo, use the wrong number, do it twice, or close the tab halfway?
- Who can see this about me? Who did I just show it to? Can I take it back?
- What if it fails? What exactly do I see and what do I do next?
- Does it work for a person with no photo, no email, a feature phone, Hindi or Punjabi, elder mode, dark mode, a slow connection?

**The professional developer:**
- Authorization: who may call this? Does the server check, or only the UI? Can I pass someone else's id? Block lists, deleted/suspended accounts, minors?
- Concurrency and idempotency: double-tap, retry, two tabs, webhook replay, race between check and write. Is any counter updated by read-modify-write?
- Failure: what if the third-party call, DB write or email fails halfway? Is state left inconsistent? Is the failure visible to the user and to us?
- Data lifecycle: what is stored, for how long, who can read it, what happens on account deletion, export, pause, refund?
- Validation and limits: server-side validation, length and range limits, rate limits, abuse (enumeration, harvesting, spam, scraping).
- Money and entitlements: is price/term/quota resolved in one place? Can it be bypassed, replayed, double-granted or left granting after expiry?
- Observability and ops: would we know it broke? Is it logged without leaking PII? Can support diagnose it from the admin panel? Feature flag and rollback story?
- Rollout and compatibility: migration safety, old clients (shipped mobile builds), config that must exist in production, defaults that differ between dev and prod.
- Tests: is the risky behaviour covered by a test that would fail on the old code?
- Consistency: does the same rule hold on web, mobile API, admin and background jobs, or is it implemented three times and has drifted?

**The operator / support / admin:**
- Can I see what happened to this member? Can I fix it without a developer? Is it audited?
- Can I refund, undo, override, export, explain? What happens if I do it twice?
- What will members write to support about this, and can I answer from the panel?

**The adversary (lightly):**
- What would a scraper, a stalker, a fraudster or a competitor do with this?

Pick the questions that are **relevant to this feature**; do not mechanically ask all of
them. Add questions the list does not cover. The best questions come from tracing the
real path and noticing something odd.

### 3. Answer each from evidence
For every question you ask, record:
- the question, in plain words;
- the answer, with `file:line` (and, if you ran something, what you ran and what came back);
- a verdict.

### 4. Verdicts

| Verdict | Meaning |
|---|---|
| `OK` | Holds up. Say why in one line. Only list OK answers when they are non-obvious or settle a likely worry. |
| `GAP` | Missing behaviour a reasonable person would expect. Nothing is broken, something is absent. |
| `BUG` | The code does the wrong thing, provably. Give the failing scenario. |
| `RISK` | Works today but fails under a plausible condition (race, load, config, scale, abuse). State the condition. |
| `DECISION` | Not a defect: a product or policy choice only the owner can make. State the options and your recommendation. |
| `UNKNOWN` | Could not determine from the code or a safe probe. Say what would settle it. |

Only `GAP`, `BUG`, `RISK`, `DECISION` and `UNKNOWN` become findings.

### 5. Severity (project legend, `docs/QA.md`)
- 🔴 **Critical**: money wrong, data exposed to the wrong person, account takeover, members locked out, data loss.
- 🟠 **High**: a core flow fails or misleads for a meaningful share of members; privacy or fairness problem; abuse is easy.
- 🟡 **Medium**: a real problem with a workaround, or a failure only under specific conditions.
- ⚪ **Low**: polish, wording, minor inconsistency, missing nicety.

Severity is about the **member and the business**, not about how clever the bug is.

## Output: the findings list

One finding per problem. Fields:

- `id`: `<AREA>-<nn>` (area codes: AUTH, PROF, DISC, MATCH, CHAT, PAY, SAFE, ADM, MKT, SITE)
- `feature`: the feature it belongs to
- `severity`: critical | high | medium | low
- `verdict`: gap | bug | risk | decision | unknown
- `question`: the question that surfaced it, phrased as someone would ask it
- `voice`: member | developer | operator | adversary
- `finding`: what is actually true, one or two sentences
- `evidence`: `file:line` plus what you ran, if anything
- `impact`: who is hurt and how
- `suggestion`: the smallest fix that would settle it, or the options if it is a decision
- `effort`: S (under an hour) | M (a day) | L (more)
- `ownerDecision`: true when it needs a product, policy, legal or money call before anyone codes

Group the final list by severity, then by area. End with a short "solid" list of
features that were interrogated and held up, so the absence of findings is visible
and not mistaken for the absence of looking.

## Notes on the project (pitfalls already learned)

- A Metro reload, a stale debug server and React Query's cache can all make a fixed
  bug look unfixed, or a broken one look fine. Start fresh before believing a probe.
- `asyncHandler` does not return the promise; tests that call controllers directly
  must flush (`await new Promise(r => setImmediate(r))`).
- A model that does not declare a column silently drops writes to it. When a value
  "never sticks", check the model first.
- Compose passes only the env vars in its explicit allowlist. A flag set in the prod
  `.env` that is not in that list does nothing.
- Prod CORS rejects no-Origin writes; API probes of POST/PUT/DELETE against a local
  instance are fine, never against production.
- The Playwright MCP browser fakes 503s for third-party hosts; check headers before
  reporting an outage.
- Seeded data lies: relative `/uploads/*` photos, hand-edited plan rows, and loadtest
  accounts. Confirm a data-shaped finding is not a seed artefact.
