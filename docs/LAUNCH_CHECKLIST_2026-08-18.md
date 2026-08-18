# TricityMatch — Launch Readiness Checklist (final walkthrough 2026-08-18)

One page, single source of truth for launch. Everything marked ✅ was **verified today**, not assumed.
Legend: ✅ done/verified · 🔑 owner action (needs an account/credential only you hold) · ⚪ optional / post-launch.

---

## 1. Quality gates (all run 2026-08-18, all green)

| Gate | Result |
|---|---|
| Backend unit tests (Jest 30) | ✅ 259/259 |
| Frontend tests (Vitest 4 + RTL) | ✅ 97/97 |
| Mobile tests (Jest 29) | ✅ 57/57 |
| Mobile TypeScript (`tsc --noEmit`) | ✅ 0 errors |
| Root lint + mobile typecheck + slop-lint | ✅ clean |
| Frontend production build (Vite 8) | ✅ builds |
| E2E Playwright (9 specs) | ⚪ not re-run today (needs live dev stack); authed web workflows walked live in the 2026-08-17 audit |

## 2. Security

- ✅ **Headers (verified live on prod):** HSTS `max-age=31536000; includeSubDomains; preload`, tight CSP (self + Razorpay + Cloudinary + Google Fonts only), `X-Frame-Options: DENY`, `nosniff`, `referrer-policy: strict-origin-when-cross-origin`.
- ✅ **TLS:** valid until **2026-10-26**, certbot renewal cron active.
- ✅ **Auth:** httpOnly 15m access + 7d rotated refresh tokens, family revoke, Redis lockout 5/30min, bcrypt.
- ✅ **Rate limiting:** 11 scoped limiters (auth 5/15m, signup 3/hr, OTP 3/hr, payment 10/hr, …).
- ✅ **Payments:** timing-safe HMAC verify, webhook supersede, no card data stored.
- ✅ **Uploads:** MIME + extension + magic-byte validation, Cloudinary `allowed_formats`, pinned `resource_type`.
- ✅ **AuthZ:** group chat membership-gated (IDOR closed), premium/mutual gates server-side, socket rooms server-authoritative.
- ✅ **Secrets:** no `.env`/keys tracked in git (only `.env.example`s); prod boot guard exits on dev secrets; `.env.production` on VPS is `600 root:root`.
- 🔑 **SSH hardening:** see §6 (left as an owner decision).
- ✅ Prior audits: 2026-03 security audit, 2026-06 9-phase audit (53 findings fixed), 2026-07 pentest (app layer clean), 0 runtime dep vulns.

## 3. Legal / privacy (India DPDP Act 2023 + store policies)

- ✅ Privacy Policy (web `/privacy` + RN mirror): data inventory, purposes, sharing, retention, cookies, children (18+), **breach-notification commitment (DPDP)**, **data-principal rights incl. erasure + nominate**, grievance channel. Last updated Aug 2026.
- ✅ Terms: eligibility, guardian consent, acceptable use, no-auto-renew payments, liability, Chandigarh jurisdiction, grievance contact.
- ✅ **Public account-deletion page `/delete-account`** (Google Play data-safety requirement): web + app steps, email fallback, what gets deleted. In sitemap.
- ✅ In-app deletion on web (Settings → Danger Zone) AND mobile (Settings → Delete Account) — `DELETE /auth/account` verified working.
- ✅ Report + Block + admin moderation queues (UGC safety requirement for both stores).
- 🔑 **Grievance Officer name** — IT Rules 2021 require a *named* officer with contact published. Policy has the mailbox; add your name (or the appointed person's) to Privacy §12.
- 🔑 **Mailboxes must actually exist**: `support@`, `privacy@`, `grievance@tricitymatch.com` are referenced in policy/terms/delete-page — create them (or forwards) before launch.

## 4. Product robustness

- ✅ Loading states: shimmer skeletons across web data views; RN skeleton pass (P1/P8 overhaul) removed all full-screen spinners on member path.
- ✅ Error states: web 4-state doctrine (default/loading/empty/error+retry) on data views; global `ErrorBoundary` at app root + route level; RN branded toasts replaced `Alert.alert`.
- ✅ Error handling: `AppError`/`asyncHandler` everywhere, prod responses hide stacks (tested), 401-refresh queue on both clients.
- ✅ Edge cases: covered by the 2026-06→08 QA history (onboarding funnels driven live on both platforms, iOS DOB keyboard fix, envelope-unwrap sweep, empty-queue crashes fixed, offline shortlist).
- ✅ RN verification is selfie-only with **live front-camera capture** (`launchCameraAsync`, no library picker) — the old "RN verification stale" note is obsolete.
- ✅ Load: 1000 VU / 6.7k rps / p95 413ms (local k6, 2026-08-17).

## 5. Production logs / observability

- ✅ Backend logs structured JSON to stdout (docker), errors separated.
- ✅ **Log rotation now on every compose service** (json-file 10m×3) — was backend-only; db/redis/frontend recreated with it today.
- ✅ VPS `docker-image-prune` + `certbot` crons active; disk 79% (11G free) — watch.
- ⚪ Prometheus + Grafana ship in compose (`--profile monitoring`) but are not running on prod. Optional.
- 🔑 **Crash reporting**: no Sentry DSN (web or mobile). Strongly recommended before store launch — otherwise native crashes are invisible.

## 6. VPS / infra (178.16.138.82, shared box — TricityMatch scope only)

- ✅ Containers healthy: backend/frontend/db/redis, restart policies, healthchecks.
- ✅ `.env.production` 600 root.
- 🔑 **sshd still allows root password login** (`PasswordAuthentication yes` via `sshd_config.d/50-cloud-init.conf`, `PermitRootLogin yes`) — open pentest finding. Recommended when ready: drop a `00-hardening.conf` with `PasswordAuthentication no` + `PermitRootLogin prohibit-password` (first-match-wins, so `00-` beats `50-cloud-init`), `sshd -t`, reload, and verify a fresh key login before closing the session. Key auth already works; Hostinger web console is the recovery path.
- ✅ **Daily DB backup cron added today**: pg_dump → gzip → `/var/backups/tricitymatch/`, 14-day retention; first run verified restorable-size dump.
- 🔑 **Off-site backup**: local dumps don't survive disk loss. Verify Hostinger VPS backup/snapshot add-on is active in hpanel (API token in this machine's MCP config was regenerated 2026-08-18 — re-check panel or MCP).
- ⚪ fail2ban not installed — low value once SSH is key-only; skip or add later.

## 7. Web launch

- ✅ Prod current: font-CSP fix live, `/health` OK, robots.txt + sitemap.xml 200, SEO meta per route, PWA icons.
- ✅ `/delete-account` + updated privacy **deployed today**.
- ✅ Legacy `tricityshadi.com` 301s pages, still proxies `/api` + `/socket.io` for shipped mobile builds.
- 🔑 **Razorpay LIVE keys** (backend `RAZORPAY_*` + `VITE_RAZORPAY_KEY_ID`) — currently placeholder; subscription purchase shows "payments opening soon". **The single biggest launch blocker.** After setting: rebuild backend+frontend, run one real ₹1 test payment + webhook.
- 🔑 SMTP creds for the documents-email leg (invoices) — transactional email already LIVE via Resend.
- ⚪ Google OAuth creds (feature auto-hidden until set) · ⚪ Agora creds for web/app calls (UI auto-hides) · ⚪ full i18n on content pages.

## 8. App store submission (both apps build-ready; store accounts are the gap)

Config verified in repo: targetSdk/compileSdk **35**, store-blocking permissions blocked (verified in a built artifact earlier), iOS usage strings + `ITSAppUsesNonExemptEncryption:false`, bundle IDs `com.tricityshadi.app`, deep-link intent filters, **console.log stripped from release bundles (added today)**.

Ordered path:
1. 🔑 `eas login && eas init` in `mobile/` — **`extra.eas.projectId` is still the literal string `tricityshadi-app`; NO EAS build can run until this is replaced.** (Slug/bundle IDs stay as-is — deliberate.)
2. 🔑 Apple Developer Program membership → fill `eas.json` submit block (appleId / ascAppId / appleTeamId).
3. 🔑 Play Console account → service-account JSON at `mobile/google-play-service-account.json` → closed testing track (**12 testers × 14 days** required before production for new personal accounts — start this clock NOW).
4. 🔑 Create Play billing products with **exact IDs `tricitymatch_*`** (permanent, must match `backend/constants/plans.js` + `mobile/src/utils/iap.ts`).
5. 🔑 Play **Data Safety form** + **account-deletion URL** → `https://tricitymatch.com/delete-account` (live). App Store **privacy nutrition labels** (collects: name, DOB, photos, phone/email, messages, coarse location city, purchase history; no tracking/ads).
6. 🔑 FCM service-account creds (push) + Sentry DSN before production rollout.
7. `eas build --profile production` both platforms → smoke on real devices → `eas submit`.
8. ⚪ After signing keys exist: `assetlinks.json` (Android App Links) + iOS associated-domains/AASA for https deep links (custom scheme `tricitymatch://` already works).
9. ⚪ Store listing assets: screenshots, feature graphic, app-review demo account (use a seeded member, NOT the admin).

## 9. Repo hygiene (done today)

- ✅ Untracked junk ignored (agent tooling, brag videos, load-test results); stale root plans/audits, generated `graphify-out/` (232 files), 11MB competitor screenshots, `.pyc`, stale root `app.json`/`API_DOCUMENTATION.md` all untracked (git history preserves them); 264MB of local generated QA reports deleted.
- ✅ Tracked = code, configs, migrations, docs/, e2e, scripts, monitoring — 1,186 → ~900 files.
- ✅ All work pushed to `origin/main` (was 24 commits ahead incl. entire RN overhaul).

---

## The short list (do these, then launch)

1. Razorpay live keys → deploy → ₹1 test payment.
2. Mailboxes (`support@` / `privacy@` / `grievance@`) + Grievance Officer name in Privacy.
3. `eas init` (projectId) → Apple + Play accounts → closed-test clock → products `tricitymatch_*` → Data Safety (deletion URL ready) → build → device smoke → submit.
4. Sentry DSN + FCM creds.
5. Verify Hostinger off-site backup is on.
6. (Recommended) SSH hardening per §6.
