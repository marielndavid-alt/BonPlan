-- Bonplan — recipe_weekly_schedule alignment
-- Sheet rows 4 (mobile↔web sync) and 11 (monthly dedup).
--
-- Intent:
--   1. Make Postgres the single source of truth for the current week, so
--      mobile and web clients never disagree on which Monday they're on.
--   2. Guarantee (recipe_id, week_start) uniqueness — calls to the mobile
--      applyWeeklyRotation are idempotent, safe under concurrent runs.
--   3. Prevent the same recipe from appearing twice in a 28-day window,
--      regardless of which caller (mobile, web, or future cron) inserts.
--
-- Idempotent: safe to re-run. Apply to staging first, then prod.

-- ---------------------------------------------------------------------------
-- 1. Source of truth for the current week.
--    Monday of the current week, interpreted in America/Toronto (target market).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_week_start()
RETURNS date
LANGUAGE sql
STABLE
AS $$
  SELECT (date_trunc('week', (now() AT TIME ZONE 'America/Toronto')))::date;
$$;

COMMENT ON FUNCTION public.current_week_start() IS
  'Monday of the current week in America/Toronto. Single source of truth for web + mobile clients. Call via supabase.rpc(''current_week_start'').';

GRANT EXECUTE ON FUNCTION public.current_week_start() TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Canonical table definition.
--    Table already exists in prod (queried by mobile code), so CREATE IF NOT
--    EXISTS is a no-op there; the subsequent ALTERs add what's missing.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.recipe_weekly_schedule (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id   uuid NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  week_start  date NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Idempotent column backfill in case the prod table predates this migration
-- and is missing one of the columns above.
ALTER TABLE public.recipe_weekly_schedule
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

-- One-time de-duplication so the unique index below can be built on prod
-- data that was inserted before the index existed. Keeps the oldest row
-- per (recipe_id, week_start) and drops the rest.
DELETE FROM public.recipe_weekly_schedule a
USING public.recipe_weekly_schedule b
WHERE a.recipe_id  = b.recipe_id
  AND a.week_start = b.week_start
  AND a.ctid > b.ctid;

-- (recipe_id, week_start) must be unique so applyWeeklyRotation is idempotent.
CREATE UNIQUE INDEX IF NOT EXISTS recipe_weekly_schedule_recipe_week_uniq
  ON public.recipe_weekly_schedule (recipe_id, week_start);

-- Lookup by week_start is the hot path for weekly rotation queries.
CREATE INDEX IF NOT EXISTS recipe_weekly_schedule_week_idx
  ON public.recipe_weekly_schedule (week_start);

-- ---------------------------------------------------------------------------
-- 3. Row-Level Security.
--    Recipes are public content, so anon + authenticated can read the
--    schedule. Writes are restricted to service_role (cron / admin).
-- ---------------------------------------------------------------------------
ALTER TABLE public.recipe_weekly_schedule ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rws_public_read ON public.recipe_weekly_schedule;
CREATE POLICY rws_public_read
  ON public.recipe_weekly_schedule
  FOR SELECT
  USING (true);

-- NOTE: mobile code currently inserts from the anon/authenticated client
-- (optimizedRecipeService.ts:46). Until row 10 moves generation into the
-- cron Edge Function (service_role), we also allow authenticated inserts.
-- Once the cron owns generation, drop this policy.
DROP POLICY IF EXISTS rws_authenticated_insert ON public.recipe_weekly_schedule;
CREATE POLICY rws_authenticated_insert
  ON public.recipe_weekly_schedule
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 4. Monthly dedup trigger (sheet row 11).
--    Hard stop: same recipe cannot be scheduled twice within a 28-day window.
--    Mobile code already filters candidates on the client side
--    (optimizedRecipeService.ts:26-33); this trigger backs that up and
--    protects the eventual cron path and any future caller.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_monthly_recipe_dedup()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.recipe_weekly_schedule
    WHERE recipe_id = NEW.recipe_id
      AND week_start >= NEW.week_start - INTERVAL '28 days'
      AND week_start <  NEW.week_start
  ) THEN
    RAISE EXCEPTION 'recipe % already scheduled within last 28 days (blocked week %)',
      NEW.recipe_id, NEW.week_start
      USING ERRCODE = 'unique_violation';
  END IF;
  RETURN NEW;
END
$$;

COMMENT ON FUNCTION public.enforce_monthly_recipe_dedup() IS
  'Blocks inserting a recipe that was scheduled within the previous 28 days. Sheet row 11.';

DROP TRIGGER IF EXISTS trg_enforce_monthly_recipe_dedup
  ON public.recipe_weekly_schedule;
CREATE TRIGGER trg_enforce_monthly_recipe_dedup
  BEFORE INSERT ON public.recipe_weekly_schedule
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_monthly_recipe_dedup();
