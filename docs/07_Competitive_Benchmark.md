# Competitive Benchmark — TricityShadi vs Shaadi.com & Jeevansathi.com

> Date: 2026-06-14. Grounded in actual code (routes/controllers/pages), not just docs.
> Goal: confirm feature completeness vs market leaders; flag missing/incomplete.

## Method
- TricityShadi inventory = backend `routes/` + `controllers/`, web `frontend/src/pages` + `App.jsx`, mobile `features/`.
- Competitor inventory = public feature/pricing pages of Shaadi.com (Gold/Diamond/Platinum) and Jeevansathi.com (Premium/Premium+/Exclusive/Selectse).

---

## 1. Core matrimonial features

| Feature | Shaadi | Jeevansathi | TricityShadi | Status |
|---|---|---|---|---|
| Profile + partner preferences | ✓ | ✓ | ✓ 14-step onboarding | ✅ |
| Search (basic/advanced/filters) | ✓ | ✓ | ✓ religion/caste/income/motherTongue/gotra/manglik | ✅ |
| Search by profile ID / keyword | ✓ | ✓ | ✅ `GET /search/by-code` (TCS-XXXXXXXX) + shareable code on profile | ✅ **CLOSED R2** |
| Express interest / accept-decline | ✓ | ✓ | ✓ match action + mutual | ✅ |
| Shortlist / favourites | ✓ | ✓ | ✓ | ✅ |
| Daily curated matches / "matches of the day" | ✓ (core) | ✓ | ✅ `GET /match/daily` (Redis IST-day cache, free 5/premium 15) | ✅ **CLOSED R1** |
| Recently viewed (profiles I viewed) | ✓ | ✓ | ✅ `GET /profile/me/recently-viewed` (all tiers) | ✅ **CLOSED R1** |
| Who viewed my profile | ✓ premium | ✓ premium | ✓ `/profile/me/viewers` (premium) | ✅ |
| Contact/phone unlock | ✓ premium | ✓ premium | ✓ `unlock-contact` | ✅ |
| Chat / messaging | ✓ premium | ✓ premium | ✓ premium + Socket | ✅ |
| Verified badge / ID verification | ✓ | ✓ | ✓ docs + selfie + bg-check (AuthBridge/Signzy) | ✅ |
| Photo privacy / blur / protect | ✓ | ✓ | ✓ photo blur + incognito | ✅ |
| Block / report / safety center | ✓ | ✓ | ✓ block/report + `/safety` | ✅ |
| Profile boost / spotlight | ✓ paid | ✓ paid | ✓ VIP boost (+8 sort) | ✅ |
| Profile completeness meter | ✓ | ✓ | ✓ | ✅ |

## 2. Astro / horoscope

| Feature | Shaadi | Jeevansathi | TricityShadi | Status |
|---|---|---|---|---|
| Kundli / guna milan matching | ✓ | ✓ | ✓ Vedic Ashtakoot 27-nakshatra/8-guna/dosha | ✅ strong |
| Manglik / dosha detection | ✓ | ✓ | ✓ | ✅ |
| Full birth-chart kundli generation/PDF | ✓ | ✓ | ⚠️ matching only, no chart gen/download | DEFERRED (heavy) |
| Talk to astrologer | ⚠️ limited | ✗ | ✓ astrologer marketplace + booking + call | ✅ **edge** |
| Numerology | ✓ | partial | ✅ life-path number + pairwise match in `horoscope-match` (web + mobile) | ✅ **CLOSED R2** |

## 3. Communication

| Feature | Shaadi | Jeevansathi | TricityShadi | Status |
|---|---|---|---|---|
| Voice intro | ✗ | ✗ | ✓ voice-intro upload | ✅ **edge** |
| Video intro / video profile | ✓ (Shaadi) | ✓ video profile | ✅ `POST /profile/video-intro` (~30s, Cloudinary) + web upload/playback | ✅ **CLOSED R2** |
| Voice / video call (in-app) | ✓ Shaadi Meet | ✓ video call | ✓ Agora voice+video (mobile); web deferred | ✅ |
| SMS / push alerts | ✓ | ✓ | ✓ FCM push + email match alerts ; SMS for OTP | WONT-DO (see note) |

## 4. Premium / assisted services

| Feature | Shaadi | Jeevansathi | TricityShadi | Status |
|---|---|---|---|---|
| Tiered paid plans | Gold/Diamond/Platinum | Premium/+/Exclusive | free/basic/premium_plus/vip | ✅ |
| Relationship manager / handpicked (VIP human) | ✓ Select Shaadi | ✓ Selectse/Khup | ⚠️ bureau role exists (mobile BureauStack), no web | partial |
| Settlement / refund guarantee | ✓ | ✓ | ❌ (policy, not feature) | GAP-policy |
| Parent / guardian managed account | ✓ | ✓ | ✓ guardian invite/candidates + family groups | ✅ **edge** |
| Success stories (public, social proof) | ✓ | ✓ | ✅ SuccessStory model + admin CRUD + public `/success-stories` + Home feed | ✅ **CLOSED R1** |
| Membership for parents / family chat | partial | partial | ✓ family group chat (socket) | ✅ **edge** |

## 5. Platform / reach

| Feature | Shaadi | Jeevansathi | TricityShadi | Status |
|---|---|---|---|---|
| Mobile app | ✓ | ✓ | ✓ RN Expo (full feature set) | ✅ |
| Multilingual UI | ✓ many | ✓ many | ⚠️ mobile en/hi/pa full; web i18n scaffold (en/hi/pa) live, existing pages still EN | partial (scaffold R1; full DEFERRED) |
| Hyperlocal focus | ✗ pan-India | ✗ | ✓ Chandigarh/Mohali/Panchkula | ✅ **edge** |

---

## Verdict
TricityShadi **meets or beats** competition on core matching, astro, verification, calls, guardian/family, and has unique edges (voice + video intro, astrologer marketplace, family groups, hyperlocal). After two parity rounds, **every buildable gap vs Shaadi/Jeevansathi is closed**; the residue is heavy/optional (kundli PDF), mechanical (full web i18n), or business/policy (settlement guarantee).

## Prioritized gaps — resolution status

### P0 — Web/mobile parity (backend built, web page was missing) — ✅ ALL CLOSED (R1)
1. **Astrologers** marketplace + booking → `/astrologers` (+detail, +bookings); in-browser call deferred ("join in app")
2. **Guardian / family** → `/guardian` (invite/revoke + read-only candidates)
3. **Calls (voice/video)** → **DEFERRED** (Agora Web SDK; mobile ships it)
4. **Standalone Verification** page → `/verification` (docs + selfie + bg-check)

### P1 — Missing vs competitor core — ✅ ALL CLOSED
5. **Daily curated matches** → `GET /match/daily` (R1)
6. **Recently viewed** → `GET /profile/me/recently-viewed` (R1)
7. **Success stories** → model + admin CRUD + public page (R1)
8. **Video intro** → `POST /profile/video-intro` + web upload/playback (R2)

### P2 — Nice-to-have / polish
9. Web multilingual (hi/pa) — scaffold live (R1); **full translation of existing pages DEFERRED** (mechanical, separate track)
10. Search by profile ID → `GET /search/by-code` + shareable `TCS-XXXXXXXX` code (R2) ✅
11. Kundli chart generation + PDF — **DEFERRED** (needs chart-render lib; heavy, low ROI pre-launch)
12. Numerology → life-path + pairwise match in `horoscope-match` (R2) ✅
13. SMS match alerts — **WONT-DO**: FCM push + email already deliver match alerts; per-event SMS is a recurring cost with marginal lift. Revisit as a paid-tier perk if retention data justifies. (OTP SMS stays.)

### P3 — Business/policy (not code) — DEFERRED
14. Settlement/refund guarantee — pricing/legal policy, not a feature
15. Relationship-manager web surface for bureau role — mobile BureauStack covers it; web port is a large separate epic

---

## Resolution log
- **R1 (2026-06-14)** — P0 web parity (Verification/Guardian/Astrologers), daily matches, recently-viewed, success stories, web i18n scaffold. Migrations 000035/000036. Spec `docs/08_Spec_Competitive_Parity.md` C1–C7.
- **R2 (2026-06-14)** — closed remaining buildable gaps: search-by-ID (`/search/by-code` + shareable profile code), video intro (`/profile/video-intro`, migration 000037), numerology (life-path + pairwise match on `horoscope-match`). Spec addendum C8–C10. Unit tests: `numerology.test.js`, `profileCode.test.js`.
- **Remaining (intentional):** web voice/video calls, kundli PDF, full web i18n, SMS match alerts (won't-do), settlement guarantee, RM web surface.
