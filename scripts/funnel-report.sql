-- Funnel report — the entire read path for the Phase 0.5 thin analytics baseline.
--
-- There is no dashboard and no ingest route by design: at current traffic a UI
-- would be false precision. Run this by hand until it stops being enough
-- (rebuild the read path as a UI at >100 signups/week):
--
--   psql "$DATABASE_URL" -f scripts/funnel-report.sql
--   docker exec -i tricitymatch-db psql -U "$DB_USER" -d "$DB_NAME" -f - < scripts/funnel-report.sql
--
-- ============================================================================
-- HOW TO READ THESE NUMBERS — two caveats, both deliberate:
--
-- 1. THE TWO PRE-ACCOUNT COUNTERS ARE INFLATED BY RESENDS.
--    `otp_send_attempted` and `otp_verify_succeeded` fire during the 2-step
--    signup, BEFORE any User row exists, so their rows carry userId NULL.
--    Postgres treats NULLs as distinct in a unique index, so they cannot be
--    deduped — and deduping them would require storing the contact
--    (email/phone), which the privacy bound forbids. One person who requests
--    three OTPs is three rows. Treat these as ATTEMPT COUNTS, not people:
--    the ratio between them is meaningful (delivery/entry success), the
--    absolute number is an upper bound on humans.
--    The three account-bound stages ARE deduped (partial unique index on
--    (userId, eventType)) and are true distinct-user counts.
--
-- 2. ACCOUNT DELETION REWRITES HISTORY RETROACTIVELY.
--    AnalyticsEvents.userId is ON DELETE CASCADE, so deleting a user erases
--    their funnel rows — last month's `account_created` count can shrink after
--    the fact. Accepted: DPDP-first beats a stable denominator at this scale.
--    (Note: the app's own "delete account" is a soft delete — status='deleted'
--    — so those rows survive; this applies to hard deletes / GDPR-DPDP erasure.)
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. Funnel, all time. Stages in order; `people` is NULL for the pre-account
--    counters because there is no person to count there (see caveat 1).
-- ---------------------------------------------------------------------------
WITH stages(step, "eventType") AS (
  VALUES (1, 'otp_send_attempted'),
         (2, 'otp_verify_succeeded'),
         (3, 'account_created'),
         (4, 'profile_60pct'),
         (5, 'first_interest_sent')
)
SELECT s.step,
       s."eventType"                                            AS stage,
       count(e.id)                                              AS events,
       count(DISTINCT e."userId")                               AS people,
       min(e."createdAt")                                       AS first_seen,
       max(e."createdAt")                                       AS last_seen
FROM stages s
LEFT JOIN "AnalyticsEvents" e ON e."eventType" = s."eventType"
GROUP BY s.step, s."eventType"
ORDER BY s.step;


-- ---------------------------------------------------------------------------
-- 2. Step-to-step conversion, all time. Percentages against the previous stage.
--    The 1→2 rate is the only one computed off inflated counters; 3→4→5 are
--    clean distinct-user rates.
-- ---------------------------------------------------------------------------
WITH stages(step, "eventType") AS (
  VALUES (1, 'otp_send_attempted'),
         (2, 'otp_verify_succeeded'),
         (3, 'account_created'),
         (4, 'profile_60pct'),
         (5, 'first_interest_sent')
),
counts AS (
  SELECT s.step, s."eventType", count(e.id) AS n
  FROM stages s
  LEFT JOIN "AnalyticsEvents" e ON e."eventType" = s."eventType"
  GROUP BY s.step, s."eventType"
)
SELECT step,
       "eventType" AS stage,
       n,
       lag(n) OVER (ORDER BY step) AS prev_stage_n,
       CASE WHEN lag(n) OVER (ORDER BY step) > 0
            THEN round(100.0 * n / lag(n) OVER (ORDER BY step), 1)
       END AS pct_of_prev
FROM counts
ORDER BY step;


-- ---------------------------------------------------------------------------
-- 3. Week over week, last 8 weeks (ISO weeks, one row per week per stage).
--    Weeks with no events are absent rather than zero — small numbers, read
--    the gaps as zeros.
-- ---------------------------------------------------------------------------
SELECT date_trunc('week', "createdAt")::date AS week_starting,
       "eventType"                           AS stage,
       count(*)                              AS events
FROM "AnalyticsEvents"
WHERE "createdAt" >= date_trunc('week', now()) - interval '7 weeks'
GROUP BY 1, 2
ORDER BY 1 DESC, 2;


-- ---------------------------------------------------------------------------
-- 4. Same thing pivoted — one row per week, one column per stage. This is the
--    view to eyeball for a trend.
-- ---------------------------------------------------------------------------
SELECT date_trunc('week', "createdAt")::date AS week_starting,
       count(*) FILTER (WHERE "eventType" = 'otp_send_attempted')   AS otp_sends,
       count(*) FILTER (WHERE "eventType" = 'otp_verify_succeeded') AS otp_verified,
       count(*) FILTER (WHERE "eventType" = 'account_created')      AS accounts,
       count(*) FILTER (WHERE "eventType" = 'profile_60pct')        AS profiles_60pct,
       count(*) FILTER (WHERE "eventType" = 'first_interest_sent')  AS first_interests
FROM "AnalyticsEvents"
WHERE "createdAt" >= date_trunc('week', now()) - interval '7 weeks'
GROUP BY 1
ORDER BY 1 DESC;


-- ---------------------------------------------------------------------------
-- 5. This week vs last week, per stage, with the delta.
-- ---------------------------------------------------------------------------
SELECT "eventType" AS stage,
       count(*) FILTER (WHERE "createdAt" >= date_trunc('week', now()))          AS this_week,
       count(*) FILTER (WHERE "createdAt" >= date_trunc('week', now()) - interval '1 week'
                          AND "createdAt" <  date_trunc('week', now()))          AS last_week,
       count(*) FILTER (WHERE "createdAt" >= date_trunc('week', now()))
         - count(*) FILTER (WHERE "createdAt" >= date_trunc('week', now()) - interval '1 week'
                              AND "createdAt" <  date_trunc('week', now()))      AS delta
FROM "AnalyticsEvents"
WHERE "createdAt" >= date_trunc('week', now()) - interval '1 week'
GROUP BY 1
ORDER BY 1;


-- ---------------------------------------------------------------------------
-- 6. Drop-off among accounts that exist right now. Answers "of the people who
--    signed up, how many got a real profile, and how many reached out?"
--    Reads live Users, so it is unaffected by caveat 1 (but see caveat 2).
-- ---------------------------------------------------------------------------
SELECT count(*)                                                       AS accounts,
       count(*) FILTER (WHERE reached_60)                             AS reached_60pct,
       count(*) FILTER (WHERE sent_interest)                          AS sent_first_interest,
       CASE WHEN count(*) > 0
            THEN round(100.0 * count(*) FILTER (WHERE reached_60) / count(*), 1)
       END                                                            AS pct_reached_60pct,
       CASE WHEN count(*) FILTER (WHERE reached_60) > 0
            THEN round(100.0 * count(*) FILTER (WHERE sent_interest)
                       / count(*) FILTER (WHERE reached_60), 1)
       END                                                            AS pct_60pct_then_interest
FROM (
  SELECT u.id,
         EXISTS (SELECT 1 FROM "AnalyticsEvents" e
                  WHERE e."userId" = u.id AND e."eventType" = 'profile_60pct')       AS reached_60,
         EXISTS (SELECT 1 FROM "AnalyticsEvents" e
                  WHERE e."userId" = u.id AND e."eventType" = 'first_interest_sent') AS sent_interest
  FROM "Users" u
  WHERE u.status <> 'deleted'
) t;
