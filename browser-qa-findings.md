# Browser UX QA — Findings

> Visual / render / UX bugs found in the live browser pass. One entry each.
> **Severity:** 🔴 Critical · 🟠 High · 🟡 Medium · ⚪ Low/Cosmetic
> **Status:** OPEN · FIXING · FIXED-VERIFIED · DEFERRED · WONTFIX

**ID scheme:** UX-001, UX-002, … (distinct from API-level P00x in `production-bugs.md`).

Each entry:
- **ID / Sev / Status**
- **URL + viewport**
- **Symptom** (what's visibly wrong) + evidence (screenshot/console line)
- **Root cause** (file:line)
- **Fix** (files + commit)
- **Validation** (re-render result)

---

## Open / In Progress
_(none yet)_

## Fixed & Verified

### UX-001 🔴 Critical → tracked as BUG-P005 — every authed GET 403'd in real browser
- **Found:** Phase A, homepage `/` desktop — console error `GET /api/success-stories → 403`. Pulling the thread (logged in as admin) proved ALL same-origin GETs 403 in the browser (notifications, admin analytics, etc.) — browsers omit Origin on same-origin GET, SEC-2 strict-CORS rejected them.
- **Fix + full evidence:** see **BUG-P005** in `production-bugs.md` (commit 055a1a6, deployed + browser-re-verified). FIXED-VERIFIED.

### UX-002 ⚪ Low — astrologer avatar placeholder 404 — FIXED-VERIFIED
- **URL+viewport:** /astrologers (all) — console `GET /images/avatar-placeholder.png → 404`.
- **Symptom:** astrologers without an avatarUrl fall back to a placeholder image that doesn't exist → broken `<img>` + console 404.
- **Root cause:** [Astrologers.jsx:46](frontend/src/pages/Astrologers.jsx#L46) + [AstrologerDetail.jsx:88](frontend/src/pages/AstrologerDetail.jsx#L88) referenced `/images/avatar-placeholder.png`, absent from `frontend/public/images/`.
- **Fix:** added `frontend/public/images/avatar-placeholder.svg` (neutral avatar) + pointed both fallbacks at it. Commit 74cf0f9, FE rebuilt+recreated.
- **Validation (live):** `/images/avatar-placeholder.svg` → 200, old `.png` → 404 (unused). Browser /astrologers → **0 console errors**, svg loads 200. **FIXED-VERIFIED**

## Deferred / Backlog

### UX-003 ⚪ Low — dashboard greeting says "there" instead of first name
- **URL+viewport:** /dashboard — heading "Good afternoon, **there**" though the user's firstName ("Qa") is available (renders correctly on /profile as "Qa Ux, 31").
- **Impact:** cosmetic personalization miss; not blocking. Backlog (verify which field the greeting reads vs profile.firstName).

## Not-a-bug
_(none yet)_
