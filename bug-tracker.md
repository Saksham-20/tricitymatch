# Bug Tracker

> Every issue. Severity · Area · Repro · Root Cause · Fix · Files · Validation.

**Legend:** 🔴 Critical · 🟠 High · 🟡 Medium · ⚪ Low/Cosmetic
**Status:** OPEN · FIXING · FIXED-VERIFIED · DEFERRED · WONTFIX

---

## Open / In Progress
_(none)_

## Candidate (needs confirm)
_(none)_

## Fixed & Verified
- **BUG-001** ⚪ Low · Frontend/Home · React 18.2 console warning on every page: "React does not recognize the `fetchPriority` prop". Root cause: camelCase `fetchPriority="high"` on hero `<img>` ([Home.jsx:615](frontend/src/pages/Home.jsx#L615)); React 18.2 doesn't map it. Fix: lowercase HTML attr `fetchpriority="high"`. Commit 2044fd2. Validation: console clear+reload → 0 warnings. **FIXED-VERIFIED**.
- **BUG-002** 🟠 High · Frontend/Auth · Failed login (wrong password) silently hard-reloaded /login with no error — user saw submit do nothing. Root cause: 401 from `/auth/login` hit the axios refresh-retry path (only `/auth/me` was exempt); refresh failed → `window.location.href='/login'` ([axios.js:75](frontend/src/api/axios.js#L75)) wiped form+error. Also login read wrong error path (`data.message` vs `data.error.message`). Affected signup/forgot/reset/OTP too. Fix: exempt all unauth auth entrypoints from refresh; read nested error message. Files: frontend/src/api/axios.js, frontend/src/context/AuthContext.jsx. Commit b845dd7. Validation: bad login → stays on /login, form preserved, "Invalid credentials" shown. **FIXED-VERIFIED**.
- **BUG-003** 🟡 Medium · Frontend/UI (app-wide) · Clicking a checkbox's label text did nothing — only the 20px box toggled. Blocked the natural click target on onboarding T&C and every other `ui/CheckBox` (filters, settings). Root cause: `onClick` on inner box div only; `<label>` had no `<input>` to forward to ([CheckBox.jsx:34](frontend/src/components/ui/CheckBox.jsx#L34)). Fix: move handler to `<label>`. Commit 33dc452. Validation: clear storage → click label text → checkbox false→true. **FIXED-VERIFIED**.

## Not-a-bug (investigated, resolved)
- **BUG-C1** 🟡→✕ Backend error responses include `stack`. Gated to `config.isDevelopment` only ([errorHandler.js:211](backend/middlewares/errorHandler.js#L211)). No prod leak. WONTFIX.
- **SEC-N1** 🔴→✕ forgot-password returns `resetToken` in body — gated to `config.isDevelopment` only ([authController.js:429](backend/controllers/authController.js#L429)); omitted in prod. pwdFingerprint binds token to current password. Not a vuln.
- **N-1** Home shows 401 in console while logged out — AuthProvider `/auth/me` session probe. Expected, browser network log not app error. Not a bug.
- **N-2** Auth cookies `Secure=false` in dev (http). Expected on localhost; verify Secure set in prod (https). Prod-checklist item, not a dev bug.

## Deferred
_(none yet)_
