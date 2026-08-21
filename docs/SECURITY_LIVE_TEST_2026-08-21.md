# Live Test — Pen Test, VPS Audit & Load Test

**Date:** 2026-08-21
**Targets:** `https://tricitymatch.com` (live), VPS `178.16.138.82` (shared, 6 sites)
**Authorization:** owner-directed. Load = "realistic launch load, co-tenant risk accepted."
Pen scope = **non-destructive** (own QA account, no writes beyond it, **no payments, no SMS, no
lockout trips**). VPS = **read-only**.
**No production data was written. Co-tenants were health-checked before, during and after.**

---

## Verdict

The **application layer is solid live** and the **network isolation on the VPS is strong**. The real
risk is not in the app — it is the **host**: SSH is brute-forceable to root with no fail2ban and
active attack traffic already in the logs, and the box is a **single vCPU** with no CDN in front, so
its only DoS defence is the app's own per-IP rate limiter (which works, but only against a single
source).

Everything the two code-audit rounds found is **still live in production** because the fix branch is
undeployed — re-confirmed here against the live site.

---

## 1 · Live pen test — application layer: PASS

| Check | Result |
|---|---|
| 15 protected API routes, unauthenticated | all **401** |
| Free QA account → `/admin/*`, `/marketing/*`, premium routes | **403 / 404** — no privilege escalation |
| Session cookies | `HttpOnly; Secure; SameSite=Strict`, 15m access / 7d refresh |
| CORS, forged `Origin` on a write | **403**, no `Access-Control-Allow-Origin` reflected |
| `TRACE /` | **405** (disabled) |
| `DELETE /admin/users/:id` as free user | **403** |
| Contact-detail IDOR (view a stranger not unlocked) | phone/email **null** — gated correctly |
| Agora channel BOLA (`?channel=ast_…` I'm not in) | **403**, no token issued |
| SQLi / NoSQLi / path-traversal / XSS strings in `search` | all handled — **200, no 5xx, no reflection** |
| `.env`, `.git/config`, `.gitignore` | **403** (host nginx denies dotfiles) |
| Source maps (`*.js.map`) | **not served** — the 200 is the SPA `index.html` fallback, not a map |
| `/package.json`, `/docker-compose.yml`, `/CLAUDE.md` etc. | **SPA fallback** (`text/html`, 9 KB shell) — **not** file leaks |
| Rate-limit response | RFC-compliant: `RateLimit-Limit: 900`, `RateLimit-Reset`, `Retry-After` |

**Correction on first pass:** the initial sweep flagged `/package.json` and a `.js.map` as `200`.
Both are the SPA catch-all returning `index.html` (`Content-Type: text/html`, 9059 bytes). No file,
config or source map is actually served. Reported here rather than left as a scary-looking 200.

### Still live in production (undeployed fix branch) — re-confirmed
- `GET /profile/:userId` still serialises the target's `User.Subscriptions` association (R1 High).
- `GET /auth/me` still returns `fcmTokens` and `googleId` (R1).
- `GET /groups/not-a-uuid` and `/guardian/candidate/xx/matches` still **500** with the driver error (R2).
- `/api/monitoring/health/full` unauth → **401** (an earlier deploy's fix holds).

---

## 2 · VPS audit — network isolation: STRONG

External TCP scan of `178.16.138.82` from off-box:

```
22   OPEN      80  OPEN      443 OPEN
3002 filtered  5002 filtered 5432 filtered 6379 filtered
9090 filtered  9100 filtered 3000/3001/9000/9001 filtered
```

Confirmed on the box with `ss -tlnp`:
- **Postgres** `127.0.0.1:5432`, **Redis** `127.0.0.1:6379`, **tricitymatch backend**
  `127.0.0.1:5002`, **frontend** `127.0.0.1:3002` — all loopback-only. None internet-reachable.
- `.env` and `.env.production` are `-rw------- root root` (600).
- `ufw` active; containers `restart=unless-stopped`, memory-capped (backend 1 GB, redis 512 MB).
- Daily `pg_dump` cron at 22:30, backups present through 2026-08-20.

Only 22/80/443 are exposed. The database and cache cannot be reached from the internet.

---

## 3 · VPS audit — host: TWO REAL GAPS

### H-1 · SSH is brute-forceable to root, no fail2ban — HIGH (operational)
Authoritative `sshd -T`:
```
permitrootlogin yes
passwordauthentication yes
pubkeyauthentication yes
```
`fail2ban`: **absent**. And the box is already under attack — `/var/log/auth.log` holds **215 failed
password attempts**, 136 from a single IP (`42.116.149.217`). Root login over a guessable password
with no rate limit and no ban is the highest-probability compromise path on this machine, and it is
being actively probed.

> Note: SSH hardening was prepared and **declined by the owner on 2026-08-18**. Re-flagged because a
> live pen test cannot honestly omit it. This is the finding I would fix first.

**Fix (owner):** `PasswordAuthentication no` + `PermitRootLogin prohibit-password` (key auth already
works — this session connected with a key), install `fail2ban`. Confirm a second key session is live
before reloading `sshd`.

### H-2 · Single vCPU, no CPU limits, no CDN — MEDIUM (availability)
`nproc` = **1**. The containers have **no CPU limit** (`NanoCpus=0`), and there is **no CDN or WAF**
in front (`Server: nginx`, no `cf-ray`). The only defence against a request flood is the app's own
per-IP rate limiter. That defends a *single* source; a distributed L7 flood would saturate the one
core and take **all six sites** down together. On this hardware, launch resilience is a CDN
question, not a code question.

**Fix (owner):** put the domain behind a CDN/WAF (Cloudflare free tier terminates most L7 floods
before they reach the core), and/or set a `cpus:` ceiling on the tricitymatch containers so a spike
in one site cannot starve the co-tenants.

### Minor
- Backups are **local only** (`/var/backups/tricitymatch`) — no `scp`/`rsync`/`s3` in the backup
  script. If the box is lost, the backups go with it. (Known owner item: off-box copy.)
- `ufw` still allows `3000/5000/5001` from anywhere — these front **co-tenant** node apps
  (`node /var/www/...` bound to `0.0.0.0`), not tricitymatch (which is loopback-only behind nginx).
  Out of scope to change here; noted for the box owner.

---

## 4 · Load test — the rate limiter is the story

Read-only GET ramp (10 → 100 VUs, ~2.5 min) against `/`, `/api/v1/subscription/plans`,
`/api/v1/success-stories`, `/monitoring/health`, with a **guardian** sampling all three co-tenants
every 3 s and set to abort on any co-tenant error.

```
7,736 requests · 59 req/s · p95 = 56.8 ms · 0% 5xx
38.98% returned 429 (rate-limited)   backend CPU ~0%   load avg peaked 0.97
co-tenants: 200 throughout, latency flat (130–320 ms, = baseline)
guardian: never tripped
```

**What this shows:** from a single source, the per-IP limiter (`RateLimit-Limit: 900` per 15 min)
sheds the flood at the edge. The 429s cost almost nothing (p95 57 ms, backend near-idle), so a
single-IP flood is a non-event and **the co-tenants never felt it**.

**What this cannot show:** true multi-IP launch capacity. The per-IP limiter caps a single generator
by design, and reproducing real launch load would need a *distributed* generator — which on a
1-core shared box is an actual DDoS of five other businesses, so it was not run. That is the correct
outcome, not a gap: the honest capacity answer for this hardware is "add a CDN," per H-2.

My test IP is briefly rate-limited on `/api` (recovers within the 15-min window); static `/` was
unaffected. No production state was written.

---

## Priority for the owner

1. **Deploy the audit branch** — the R1 High and the R2 findings are live right now.
2. **Harden SSH + install fail2ban** (H-1) — actively being brute-forced today.
3. **Put the site behind a CDN** (H-2) — the only real launch-availability control on a 1-core box.
4. Off-box backup copy; rotate the credentials the R1 rotation list names.

Application security is in good shape live. The exposure that remains is operational, and three of
the four items above are configuration an operator applies, not code.
