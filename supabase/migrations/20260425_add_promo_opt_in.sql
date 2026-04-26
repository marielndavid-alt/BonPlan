-- Web settings: nouvelle case "Recevoir les promotions hebdomadaires"
-- Stockée par utilisateur dans user_preferences. Default true (opt-in
-- au moment de la création du compte) — les users peuvent désactiver.
ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS promo_opt_in BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN public.user_preferences.promo_opt_in IS
  'true = user accepte de recevoir les emails/notifications promo hebdomadaires.';
