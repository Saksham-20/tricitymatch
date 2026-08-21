#!/usr/bin/env bash
#
# Encrypted PostgreSQL backup for TricityMatch.
#
# Written by the 2026-08-21 security audit. The existing backup path produced a
# PLAINTEXT dump, on the same host as the database, of a corpus that contains
# every unencrypted PII column in the system: exact dates of birth, birth times,
# places of birth, caste, income, KYC selfie and liveness-video URLs, chat
# bodies, IP addresses and third-party guardian phone numbers. gzip is
# compression, not encryption. Anyone with read access to /var/backups -- which
# on a VPS shared with five co-tenant sites is a larger set than it looks -- had
# the entire member database.
#
# This script encrypts to a PUBLIC key, so the running server can create backups
# but cannot decrypt them. The private key belongs off the machine.
#
# Setup (once, on a trusted workstation, NOT on the server):
#     age-keygen -o tricitymatch-backup.key       # keep this OFF the server
#     grep 'public key' tricitymatch-backup.key   # put this on the server
#
# Server configuration:
#     BACKUP_AGE_RECIPIENT=age1...        # the PUBLIC key
#     BACKUP_DIR=/var/backups/tricitymatch
#     BACKUP_RETENTION_DAYS=14
#     PGHOST / PGUSER / PGDATABASE / PGPASSWORD  (or a ~/.pgpass entry)
#
# Restore:
#     age -d -i tricitymatch-backup.key backup.sql.gz.age | gunzip | psql "$TARGET"
#
# Verify a backup is restorable -- do this on a schedule, not once. A backup you
# have never restored is a hypothesis, not a backup:
#     bash scripts/backup-db.sh --verify /path/to/backup.sql.gz.age
#
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/tricitymatch}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
RECIPIENT="${BACKUP_AGE_RECIPIENT:-}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"

die() { echo "backup: $*" >&2; exit 1; }

command -v pg_dump >/dev/null || die "pg_dump not found"
command -v age     >/dev/null || die "age not found (apt install age)"

# ── Verify mode ──────────────────────────────────────────────────────────────
if [[ "${1:-}" == "--verify" ]]; then
  ARCHIVE="${2:-}"
  [[ -f "$ARCHIVE" ]] || die "usage: $0 --verify <archive.sql.gz.age>"
  IDENTITY="${BACKUP_AGE_IDENTITY:-}"
  [[ -n "$IDENTITY" ]] || die "set BACKUP_AGE_IDENTITY to the private key to verify"

  SCRATCH_DB="tricitymatch_restore_check_$$"
  echo "backup: restoring $ARCHIVE into $SCRATCH_DB"
  createdb "$SCRATCH_DB"
  trap 'dropdb --if-exists "$SCRATCH_DB"' EXIT
  age -d -i "$IDENTITY" "$ARCHIVE" | gunzip | psql -q -d "$SCRATCH_DB" >/dev/null
  TABLES=$(psql -tAd "$SCRATCH_DB" -c \
    "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';")
  USERS=$(psql -tAd "$SCRATCH_DB" -c 'SELECT count(*) FROM "Users";')
  echo "backup: restored OK — $TABLES tables, $USERS users"
  [[ "$TABLES" -gt 10 ]] || die "restore looks wrong: only $TABLES tables"
  exit 0
fi

# ── Backup mode ──────────────────────────────────────────────────────────────
[[ -n "$RECIPIENT" ]] || die "BACKUP_AGE_RECIPIENT is not set — refusing to write an unencrypted dump"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

TARGET="$BACKUP_DIR/tricitymatch-$STAMP.sql.gz.age"
TMP="$TARGET.partial"

# Single pipeline: the plaintext dump is never written to disk at any point.
# `set -o pipefail` means a pg_dump failure fails the whole command rather than
# leaving a truncated archive that looks successful.
pg_dump --no-owner --no-privileges \
  | gzip -9 \
  | age -r "$RECIPIENT" -o "$TMP"

# Only publish the final name once the pipeline succeeded, so a partial archive
# is never mistaken for a good one.
mv "$TMP" "$TARGET"
chmod 600 "$TARGET"

SIZE=$(wc -c < "$TARGET")
[[ "$SIZE" -gt 4096 ]] || die "archive is only ${SIZE} bytes — refusing to accept it"
echo "backup: wrote $TARGET (${SIZE} bytes)"

# Retention. Applied only to this script's own artefacts.
find "$BACKUP_DIR" -name 'tricitymatch-*.sql.gz.age' -mtime "+$RETENTION_DAYS" -delete
echo "backup: pruned archives older than ${RETENTION_DAYS} days"

# Off-box copy. Local dumps do not survive disk loss or host compromise, and an
# attacker who owns the box owns the backups too.
if [[ -n "${BACKUP_REMOTE_TARGET:-}" ]]; then
  rsync -a --chmod=600 "$TARGET" "$BACKUP_REMOTE_TARGET" \
    && echo "backup: copied off-box to $BACKUP_REMOTE_TARGET" \
    || die "off-box copy FAILED — the only copy is on the database host"
else
  echo "backup: WARNING BACKUP_REMOTE_TARGET unset — this archive exists only on the DB host" >&2
fi
