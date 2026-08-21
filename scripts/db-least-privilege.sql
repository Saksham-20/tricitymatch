-- Least-privilege database role for TricityMatch.
--
-- Written by the 2026-08-21 security audit. NOT APPLIED -- this requires a
-- deliberate cutover, see docs/SECURITY_AUDIT_2026-08-21_R1.md.
--
-- Today the application connects as the database owner (docker-compose passes
-- the same DB_USER that POSTGRES_USER created, which is the container
-- superuser). The consequence: any SQL injection or RCE in the Node process
-- yields DROP DATABASE, COPY ... TO PROGRAM, and an unrestricted
-- UPDATE "Users" SET role='super_admin'. The audit found no injection, but
-- least privilege is what decides how bad the next one is.
--
-- scripts/init-db.sql already contained the right idea and had it commented out
-- -- and its GRANT ALL was too broad anyway: the application needs no DDL at
-- runtime. Boot-time migrations do, so they get a separate role.
--
-- Three roles:
--   tricitymatch_owner   owns the schema; runs migrations only
--   tricitymatch_app     the application's runtime role; DML only, no DDL
--   tm_exporter          read-only metrics scraping (postgres-exporter)

\set ON_ERROR_STOP on

-- ── Roles ────────────────────────────────────────────────────────────────────
-- Passwords are placeholders. Generate real ones and set them via \set or ALTER
-- ROLE afterwards; do not commit them.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tricitymatch_app') THEN
    CREATE ROLE tricitymatch_app LOGIN PASSWORD 'CHANGE_ME_APP';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tm_exporter') THEN
    CREATE ROLE tm_exporter LOGIN PASSWORD 'CHANGE_ME_EXPORTER';
  END IF;
END
$$;

-- ── Runtime role: DML only ───────────────────────────────────────────────────
GRANT CONNECT ON DATABASE current_database() TO tricitymatch_app;
GRANT USAGE ON SCHEMA public TO tricitymatch_app;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO tricitymatch_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO tricitymatch_app;

-- Applies to tables created by future migrations, so this does not have to be
-- re-run after every deploy.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO tricitymatch_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO tricitymatch_app;

-- Explicitly NOT granted, and each for a reason:
--   CREATE on schema  -- the app never needs to create objects at runtime
--   TRUNCATE          -- a single statement that empties a table
--   REFERENCES        -- lets a role attach FKs to tables it does not own
--   pg_read_server_files / pg_execute_server_program -- COPY ... TO PROGRAM
REVOKE CREATE ON SCHEMA public FROM tricitymatch_app;

-- ── Metrics role: read-only ──────────────────────────────────────────────────
GRANT CONNECT ON DATABASE current_database() TO tm_exporter;
GRANT pg_monitor TO tm_exporter;

-- ── Verification ─────────────────────────────────────────────────────────────
-- Run these AS tricitymatch_app after the cutover. Each must fail.
--
--   CREATE TABLE should_not_work (id int);
--     -- ERROR: permission denied for schema public
--   TRUNCATE "Users";
--     -- ERROR: permission denied for table Users
--   COPY (SELECT 1) TO PROGRAM 'id';
--     -- ERROR: must be superuser or a member of pg_execute_server_program
--   DROP TABLE "Messages";
--     -- ERROR: must be owner of table Messages
--
-- And these must succeed:
--   SELECT count(*) FROM "Users";
--   INSERT INTO "AnalyticsEvents" (...) VALUES (...);
