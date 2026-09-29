# Backups and disaster recovery

Status: **tooling ready in the repo, not yet installed on the VPS.** Everything below marked
*owner* needs a person with the server and an off-box location. Nothing here has been run
against production. (Audit P1-11.)

## Targets

| | Target | Why |
|---|---|---|
| **RPO** (data we can lose) | 24 hours | One encrypted dump a day is what the box can carry (1 vCPU, shared). Payments are reconcilable from Razorpay, so a day of member-side loss is recoverable in practice. Tighten with WAL archiving if the member base grows. |
| **RTO** (time to be back) | 4 hours | Restore the latest dump into a fresh `postgres:15-alpine`, run migrations, bring the backend up. To be **replaced by the measured figure** from the first rehearsal. |

## What exists

- `scripts/backup-db.sh` — `pg_dump | gzip | age` to a PUBLIC key (the server can write backups
  but cannot read them), 14-day local retention, optional `BACKUP_REMOTE_TARGET` rsync,
  and `--verify <archive>` which restores into a scratch database and counts tables and users.
- `scripts/db-least-privilege.sql` — owner / app / exporter roles. Not applied; see
  `docs/SECURITY_AUDIT_2026-08-21_R1.md` for the cutover.

## Install (owner, once)

1. On a trusted workstation: `age-keygen -o tricitymatch-backup.key`. Keep the private key
   **off the server** (password manager + one offline copy).
2. On the VPS: `apt install age`; copy `scripts/backup-db.sh` to `/root/`; set
   `BACKUP_AGE_RECIPIENT` (the `age1...` public key), `BACKUP_DIR`, `BACKUP_REMOTE_TARGET`
   (an off-box host or bucket) and DB credentials (`~/.pgpass`, mode 600).
3. Replace the current plaintext cron (`/root/tricitymatch-db-backup.sh`, 22:30 UTC) with:
   `30 22 * * * /root/backup-db.sh >> /var/log/tricitymatch-backup.log 2>&1`
4. Delete the old plaintext dumps in `/var/backups/tricitymatch` after the first encrypted
   dump has been verified. `pg_dump | gzip` masks a failed dump (pipe status): check the file
   size, and rely on `--verify`, not on the cron exit code.

## Monthly rehearsal (owner, first Monday)

1. Pull the newest archive from the **off-box** copy, not from the server.
2. `BACKUP_AGE_IDENTITY=/path/to/tricitymatch-backup.key bash scripts/backup-db.sh --verify <archive>`
   on a workstation with Postgres 15.
3. Time it, and spot-check: member count within 1 day of production, latest subscription
   row present, `SequelizeMeta` matches the deployed migration count.
4. Append a row below. A rehearsal that was not logged did not happen.

| Date | Archive | Restore time | Users restored | Result / notes |
|---|---|---|---|---|
| _(first rehearsal pending)_ | | | | |

## If production is lost

1. New VPS or the same box: Docker, this repo, `.env` (from the password manager).
2. `docker compose up -d postgres redis redis-queue`.
3. Decrypt (`age -d -i key archive | gunzip | psql`), then `docker compose up -d backend frontend`;
   pending migrations apply on boot.
4. Run `reconcilePendingOrders` (it runs every 30 minutes on its own) to pick up payments that
   landed after the last dump; check Razorpay for anything older than the reconciler window.
5. Media lives at Cloudinary, not in the database: nothing to restore there. Chat rows older
   than `MESSAGE_RETENTION_MONTHS` are gone by design.
