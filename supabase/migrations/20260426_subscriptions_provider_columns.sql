-- Ajout de colonnes pour distinguer le provider (Stripe vs RevenueCat) et garantir
-- l'idempotence + l'ordre correct des événements de webhook.
-- Toutes les colonnes sont NULL par défaut: migration additive, pas de breaking change.

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS revenuecat_app_user_id TEXT,
  ADD COLUMN IF NOT EXISTS provider TEXT,
  ADD COLUMN IF NOT EXISTS last_event_at_ms BIGINT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'subscriptions_provider_check'
  ) THEN
    ALTER TABLE public.subscriptions
      ADD CONSTRAINT subscriptions_provider_check
      CHECK (provider IS NULL OR provider IN ('stripe', 'revenuecat'));
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS subscriptions_revenuecat_app_user_id_idx
  ON public.subscriptions (revenuecat_app_user_id)
  WHERE revenuecat_app_user_id IS NOT NULL;
