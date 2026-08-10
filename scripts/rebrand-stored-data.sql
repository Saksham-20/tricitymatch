-- Rebrand leftover "TricityShadi" strings in stored rows.
--
-- The 2026-07-29 rename (commit 57762c9) covered source, not data already
-- written by the old build. Application code is clean — verified by grep over
-- backend/, frontend/src/ and mobile/src/ — so this only needs to run once per
-- environment, and re-running it is harmless.
--
-- Dev was updated on 2026-08-09 (3 Notifications rows). Production still needs it.
--   psql "$DATABASE_URL" -f scripts/rebrand-stored-data.sql

BEGIN;

-- Preview what will change (safe to read before committing)
SELECT 'Notifications' AS table_name, count(*) AS rows_to_update
FROM "Notifications"
WHERE title LIKE '%TricityShadi%' OR body LIKE '%TricityShadi%'
UNION ALL
SELECT 'SuccessStories', count(*)
FROM "SuccessStories"
WHERE quote LIKE '%TricityShadi%' OR "coupleNames" LIKE '%TricityShadi%';

UPDATE "Notifications"
SET title = replace(title, 'TricityShadi', 'TricityMatch'),
    body  = replace(body,  'TricityShadi', 'TricityMatch')
WHERE title LIKE '%TricityShadi%' OR body LIKE '%TricityShadi%';

UPDATE "SuccessStories"
SET quote         = replace(quote, 'TricityShadi', 'TricityMatch'),
    "coupleNames" = replace("coupleNames", 'TricityShadi', 'TricityMatch')
WHERE quote LIKE '%TricityShadi%' OR "coupleNames" LIKE '%TricityShadi%';

COMMIT;
