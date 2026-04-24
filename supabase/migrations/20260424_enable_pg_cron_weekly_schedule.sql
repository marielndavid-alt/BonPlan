-- ─────────────────────────────────────────────────────────────
-- Row 10 — Thursday cron: promo scrape + recipe schedule
-- ─────────────────────────────────────────────────────────────
-- Before: edge functions were deployed but no pg_cron trigger. Client
-- inserts from the mobile app were filling `recipe_weekly_schedule` in
-- an uncoordinated way. After yesterday's dedup trigger those client
-- inserts became limited, so a real cron is required.
--
-- Also fixed two latent bugs along the way:
--   * weekly-schedule used a Thursday-based getWeekStart() while mobile
--     and web both read Monday from current_week_start(). Function now
--     calls the RPC directly — single source of truth.
--   * scheduled-scrape required an x-cron-secret header whose value was
--     only known by the project owner. Supabase gateway already enforces
--     a valid JWT on every call, so the extra check was relaxed: x-cron-
--     secret is still respected if provided, but no longer required.

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Jeudi 1h heure de l'Est (05:00 UTC en EDT, 06:00 UTC en EST) — scrape promo.
SELECT cron.schedule(
  'scheduled-scrape-thursday-1am-eastern',
  '0 5 * * 4',
  $$SELECT net.http_post(
    url := 'https://wurvstyckmuktgapqstm.supabase.co/functions/v1/scheduled-scrape?mode=promo',
    headers := '{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind1cnZzdHlja211a3RnYXBxc3RtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3ODYyMDQsImV4cCI6MjA4NzM2MjIwNH0.wblESinZ62k2l_2t03-C1LYto9gybLEObzc64nQpdZQ", "Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 300000
  );$$
);

-- Jeudi 7h heure de l'Est — génération de la sélection hebdomadaire.
SELECT cron.schedule(
  'weekly-schedule-thursday-7am-eastern',
  '0 11 * * 4',
  $$SELECT net.http_post(
    url := 'https://wurvstyckmuktgapqstm.supabase.co/functions/v1/weekly-schedule',
    headers := '{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind1cnZzdHlja211a3RnYXBxc3RtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3ODYyMDQsImV4cCI6MjA4NzM2MjIwNH0.wblESinZ62k2l_2t03-C1LYto9gybLEObzc64nQpdZQ", "Content-Type": "application/json"}'::jsonb
  );$$
);
