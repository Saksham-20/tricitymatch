# 09 — Comprehensive Audit & Review System

> Permanent methodology for full-project audits of TricityShadi. The live tracker is
> [`review-progress.md`](../review-progress.md) at the repo root — it is the single
> source of truth. This doc explains **how** to run the audit; the tracker records
> **what** was found.

## Operating principles

1. **Never audit the whole project in one pass.** Work in small chunks, one item at a time.
2. **The tracker is the memory.** Read [`review-progress.md`](../review-progress.md) before any chunk; update it after. Never rely on conversation memory.
3. **Evidence or it didn't happen.** Every finding cites exact `file:line`. Never assume code exists; never hallucinate missing code. Verify from actual source.
4. **Use skills — never do manually what a skill does.** Map each phase to its gstack skill (table below). Run report-only variants first, fix in a separate chunk.
5. **Finish one area before starting the next.** Dependencies first (architecture → backend → DB → security), surface area last (SEO → QA → missing features).

## Severity scale

| Severity | Meaning |
|----------|---------|
| **Critical** | Exploitable vuln, data loss, or production-down. Fix before next deploy. |
| **High** | Broken core flow or likely incident under normal use. |
| **Medium** | Degraded UX/performance/maintainability. |
| **Low** | Polish, nice-to-have, cosmetic. |

## Per-chunk process

For each unchecked item in the tracker:

1. Read `review-progress.md`; pick the first phase not `✅ Done`, then its first `[ ]` item.
2. Review **only that item** against actual source files.
3. For each finding, record: **Problem · Impact · Evidence (`file:line`) · Recommended Fix · Severity**.
4. Append to the phase block **and** the relevant master table (Critical / Bugs / Security / Refactoring).
5. Check the item, update the phase Status + `Last Updated`. Stop or continue.

## Phase → skill map

| Phase | Scope | Drive with | Report-only first |
|-------|-------|-----------|-------------------|
| 1 Architecture | folder/module boundaries, deps, tech debt | `/health`, `/investigate` | `/health` is read-only |
| 2 Backend | routes, controllers, logic utils, validation, sockets, webhooks | `/code-review`, `/security-review` | `/code-review` (no `--fix`) |
| 3 Database | schema, indexes, relations, migrations | `/health` + manual SQL | read-only |
| 4 Security | full OWASP (see below) | `/security-review`, `/cso` | both report findings |
| 5 Frontend | components, state, routing, forms, states | `/design-review`, `/code-review` | `/design-review` reports then fixes |
| 6 SEO | meta, robots, sitemap, OG, structured data | manual + `/browse` | `/browse` to inspect rendered DOM |
| 7 Performance | bundle, lazy-load, queries, caching | `/benchmark`, `/browse`, `/qa` | `/benchmark` measures first |
| 8 QA | functional, edge, flows, a11y, responsive | `/qa-only` → `/qa` | `/qa-only` is report-only |
| 9 Missing features | PRD diff, journey gaps, parity | `/spec`, diff vs `docs/01_PRD.md` | n/a |

> All web inspection goes through `/browse` (never raw WebFetch/WebSearch), per project rule.

## OWASP security checklist (Phase 4)

Run with `/security-review` and `/cso`. Cover every item, cite evidence:

- Broken Authentication — JWT httpOnly (access 15m / refresh 7d hashed), rotation + family revoke, lockout 5/30min (Redis)
- Broken Authorization — `adminAuth`, `requirePremium`/`requireVIP`, role gates
- IDOR — `profile/:id`, `match/:id`, chat, admin/marketing resources
- Session Management — logout-all, refresh-token reuse detection
- JWT Security — secret strength, prod `process.exit(1)` guard in `backend/config/env.js`
- Password Security — hashing (bcrypt), complexity rules, reset flow
- API Abuse / Rate Limiting — 9 limiters; verify coverage on every sensitive route
- SQL / NoSQL Injection — Sequelize parameterization, any raw queries
- XSS — stored (bio, messages) + reflected; sanitize middleware
- CSRF — cookie auth + SameSite + CORS allowlist
- SSRF — Cloudinary uploads, webhook callbacks, outbound fetches
- RCE — file handling, deserialization, template injection
- File Upload — Multer magic-byte check, size caps, voice/video resource type
- Dependency Vulnerabilities — `npm audit` across workspaces
- Sensitive Data Exposure — PII in logs/responses, error leakage
- Secrets in Source — grep for keys; confirm `.env*` gitignored
- CORS Misconfiguration — origin allowlist (hardened 2026-03-12, re-verify)

## Missing-feature detection (Phase 9)

Diff shipped reality against intent:

- **PRD** ([docs/01_PRD.md](01_PRD.md)) vs implemented routes/screens
- **User journeys** — dead ends, missing screens
- **API coverage** — endpoints the UI calls but backend lacks (and vice-versa)
- **Validation parity** — frontend rules vs `backend/validators/index.js`
- **Security controls** — gaps surfaced in Phase 4
- **Mobile parity** — RN feature areas vs web routes
- **Known incomplete** (verify each, don't assume): Razorpay placeholder, Email/Google OAuth off, SMS OTP key, FCM push stub, web in-browser calls (deferred), kundli PDF, full web i18n

## Final deliverables (after all phases `✅`)

Produced from the tracker's accumulated, evidence-cited findings:

1. Executive Summary
2. Security Report (OWASP)
3. Architecture Report
4. Bug Report
5. Missing Features Report
6. Technical Debt Report
7. Production Readiness Report
8. Prioritized Action Plan

## Resuming after context loss

The audit survives any number of sessions: open `review-progress.md`, find the first
non-`✅` phase and its first `[ ]` item, and continue. No conversation history required.
