# Deploy runbook: audit branch `fix/audit-p0-2026-09`

Covers 49 commits (P0, P1, P2 of `docs/AUDIT_2026-09-29/README.md`). Nothing here has been run
against production. Steps marked **owner** need a person with the server or a third-party console.

## Pre-flight (done 2026-09-29, from the laptop)

| Check | Result |
|---|---|
| `main` is an ancestor of the branch (fast-forward possible) | yes, 0 behind, 49 ahead |
| Merge conflicts | none |
| Migrations 000001-000079 on an empty database | all 79 apply in order |
| Migrations 000065-000079 on the dev database (incremental) | applied |
| New env vars visible to the backend container | all in the compose allowlist (`SMS_DAILY_BUDGET` and `VERIFICATION_REQUIRE_CAPTURE_TOKEN` added at the end; both default to the code defaults) |
| Gates | BE 1207, FE 190 + build, mobile 72 + `tsc` 0, eslint 0 errors |

Not verifiable from here: the prod `.env` contents, the prod row counts, the Razorpay dashboard,
Play Console / App Store state, and the image-moderation provider.

## Decisions to make before pushing

1. **Mobile ships with, or after, the backend.** Signup now requires a single-use proof from
   `verify-otp` (`emailProof` / `phoneProof`). Store builds already in users' hands do not send it, so
   **new sign-ups from old app builds fail** until the new build is live. Existing members are
   unaffected. Either release the app first / at the same time, or accept a window with web-only
   sign-up.
2. **`IMAGE_MODERATION_PROVIDER`.** Photos are screened on upload. Default is the stub (holds
   nothing). Choose the provider deliberately; with none, the review queue only fills from
   stolen-photo reports.
3. **`STAFF_MFA_REQUIRED`** stays off at deploy. Enrol every admin (Settings, Account), then set it.
4. **Free-reply window** is already live in prod. No change.

## Prod `.env` checks (read only, before deploy) - owner or with SSH approval

The backend now refuses to boot in production on: `OTP_BYPASS_CODES` set, `ALLOW_INSECURE_PROD`,
a weak JWT/cookie/DB secret, or a placeholder Razorpay/SMTP value. Confirm before building:

```bash
ssh tricityshadi-vps 'cd /var/www/tricitymatch && grep -cE "^(OTP_BYPASS_CODES|ALLOW_INSECURE_PROD)=" .env; grep -E "^REDIS_PASSWORD=" .env | sed "s/=.*/=<set>/"'
```

Expect `0` and `REDIS_PASSWORD=<set>` (compose now requires it for the second Redis).

## Order of operations

```bash
# 0. local
git checkout main && git merge --ff-only fix/audit-p0-2026-09 && git push origin main

# 1. backup (check the SIZE - a failed pg_dump piped to gzip still produces a file)
ssh tricityshadi-vps 'cd /var/www/tricitymatch && docker exec tricitymatch-db pg_dump -U "$DB_USER" "$DB_NAME" | gzip > /var/backups/tricitymatch/db-pre-audit-2026-09-29.sql.gz && ls -l /var/backups/tricitymatch/db-pre-audit-2026-09-29.sql.gz'

# 2. duplicates that would fail the unique-index migration (000052 already ran; these are the new ones)
#    none of 000065-000079 adds a unique index over existing data, so no pre-check is needed.

# 3. pull + build (project containers only, never global docker commands - shared VPS)
ssh tricityshadi-vps 'cd /var/www/tricitymatch && git pull --ff-only && docker compose build backend frontend'

# 4. start the new non-evicting Redis, then backend (runs pending migrations on boot via umzug), then frontend
ssh tricityshadi-vps 'cd /var/www/tricitymatch && docker compose up -d redis-queue && docker compose up -d --no-deps --force-recreate redis backend && docker compose up -d --no-deps --force-recreate frontend'

# 5. move existing private media behind signed URLs (P1-4), once
ssh tricityshadi-vps 'docker exec tricitymatch-backend node scripts/migrate-private-media.js'            # dry run by default: read the output
ssh tricityshadi-vps 'docker exec tricitymatch-backend node scripts/migrate-private-media.js --execute'
```

Recreating `redis` switches it to `volatile-lru`; cached keys are lost (harmless, they are caches and
OTP/lockout keys carry TTLs). Queued jobs now live in `redis-queue`; any job still in the old instance
at switch time is dropped (the weekly digest and alerts are recomputed by their crons).

## Verify (all from outside)

```bash
curl -s https://tricitymatch.com/health                       # {"status":"ok",...} only, no service detail
curl -s -o /dev/null -w '%{http_code}\n' https://tricitymatch.com/api/monitoring/health/full   # 401
curl -s https://tricitymatch.com/api/v1/subscription/plans | head -c 300                        # Premium only, unchanged
curl -s -o /dev/null -w '%{http_code}\n' https://tricityshadi.com/api/v1/subscription/plans     # 200, legacy proxy for shipped apps
```

Then, signed in as the prod QA member: search with `education=Master`, open a profile, download the
biodata PDF, Settings → Privacy (new "Details you share"), Settings → Account (recent sign-ins,
pause / delete). Confirm co-tenant sites (edumapping, school.globoniks, tricitylifeinsurance) still 200.

## Third-party settings that must change with this deploy - owner

- Razorpay dashboard → Webhooks: enable `refund.processed`, `refund.failed`, `payment.dispute.*`
  (refunds and lost disputes only end a plan when these arrive) and `payment.failed`.
- Set real `VITE_LEGAL_*` values (entity, address, GSTIN, Grievance Officer) in the frontend build
  args, then run `scripts/check-legal-disclosures.sh`.
- Decide `SMS_DAILY_BUDGET` (default 1500 a day), `MESSAGE_RETENTION_MONTHS`,
  `ACCOUNT_DELETION_GRACE_DAYS` (default 30) and leave `SOCKET_REDIS_ADAPTER` false (one instance).
- Host log retention 180 days, backup job install and restore rehearsal (`docs/BACKUP_DR.md`).

## Rollback

- **Code:** `git revert -m 1` is not needed for a fast-forward; instead check out the previous
  commit on the server (`git rev-parse HEAD` is recorded before step 3), rebuild `backend frontend`,
  recreate them.
- **Database:** the additive migrations (000070-000079 add columns / tables only) are safe to leave
  in place under old code (000071 and 000077 only backfill the new columns). 000065-000069 likewise. If a real schema rollback is required, restore
  `db-pre-audit-2026-09-29.sql.gz`; do not run `db:migrate:undo` in production.
- **Redis:** re-point `QUEUE_REDIS_HOST` to `redis` and recreate the backend.
