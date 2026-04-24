-- ─────────────────────────────────────────────────────────────
-- Row 15 — Paywall côté base (RLS)
-- ─────────────────────────────────────────────────────────────
-- Before: les tables de prix (recipe_store_prices, recipe_ingredient_prices,
-- recipe_prices_by_store, ingredient_best_prices) étaient lisibles par tout
-- anon. Le paywall était purement côté client — DevTools + requête directe
-- à Supabase = accès gratuit au contenu premium.
--
-- After: lecture de ces tables réservée aux users avec un
-- `subscriptions.status IN ('active','trialing')`. Les autres tables
-- (recipes, recipe_weekly_schedule, stores, ...) restent lisibles pour que
-- la grille charge correctement et que le modal paywall puisse s'afficher
-- par-dessus.
--
-- Service role bypass RLS par défaut → les edge functions (scheduled-scrape,
-- weekly-schedule, etc.) continuent d'écrire normalement.

-- ── Helper: user courant a un abonnement actif ? ──────────────
CREATE OR REPLACE FUNCTION public.is_current_user_premium()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions s
    WHERE s.user_id = auth.uid()
      AND s.status IN ('active','trialing')
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_current_user_premium() TO anon, authenticated;

COMMENT ON FUNCTION public.is_current_user_premium() IS
  'Returns true if auth.uid() has an active or trialing subscription. Used by paywall RLS policies.';

-- ── recipe_store_prices ──────────────────────────────────────
ALTER TABLE public.recipe_store_prices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "premium_read" ON public.recipe_store_prices;
CREATE POLICY "premium_read" ON public.recipe_store_prices
  FOR SELECT TO anon, authenticated
  USING (public.is_current_user_premium());

-- ── recipe_ingredient_prices ─────────────────────────────────
ALTER TABLE public.recipe_ingredient_prices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "premium_read" ON public.recipe_ingredient_prices;
CREATE POLICY "premium_read" ON public.recipe_ingredient_prices
  FOR SELECT TO anon, authenticated
  USING (public.is_current_user_premium());

-- ── recipe_prices_by_store ───────────────────────────────────
-- La policy "full access" était une ALL avec qual=true (ouvert à tous).
DROP POLICY IF EXISTS "full access" ON public.recipe_prices_by_store;

DROP POLICY IF EXISTS "premium_read" ON public.recipe_prices_by_store;
CREATE POLICY "premium_read" ON public.recipe_prices_by_store
  FOR SELECT TO anon, authenticated
  USING (public.is_current_user_premium());

-- ── ingredient_best_prices ───────────────────────────────────
DROP POLICY IF EXISTS "full access" ON public.ingredient_best_prices;

DROP POLICY IF EXISTS "premium_read" ON public.ingredient_best_prices;
CREATE POLICY "premium_read" ON public.ingredient_best_prices
  FOR SELECT TO anon, authenticated
  USING (public.is_current_user_premium());
