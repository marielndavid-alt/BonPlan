-- ─────────────────────────────────────────────────────────────
-- Hardening — retirer l'accès anon en écriture
-- ─────────────────────────────────────────────────────────────
-- Before: n'importe quel appel anonyme à Supabase (pas besoin d'être
-- connecté) pouvait INSERT/UPDATE/DELETE sur les tables cœur — recipes,
-- products, stores, prices, price_history, recipe_ingredients,
-- ingredient_*. Un simple curl avec la clé anon publique suffisait à
-- vider la base de recettes ou falsifier les prix.
--
-- Deux problèmes distincts:
--   1. Sur les tables avec RLS désactivé (recipes, products, stores,
--      prices), les grants table-level laissaient anon écrire même sans
--      policy. On active RLS → seules les policies décident.
--   2. Sur les tables avec RLS activé, des policies "anon_insert/update/
--      delete" autorisaient l'écriture. On les drop.
--
-- After: anon ne peut plus qu'écrire nulle part. Lectures (anon_select_*)
-- préservées. Les edge functions (service_role) bypass RLS donc
-- scheduled-scrape etc. continuent d'écrire normalement.
--
-- NOTE suivi: les policies "authenticated_*" avec qual=true laissent
-- encore n'importe quel user connecté écrire sur recipes/products/etc.
-- À resserrer dans une passe suivante (besoin de clarifier ce que fait
-- l'admin portal — service_role ou simple auth).

-- ── Étape 1: drop toutes les policies anon INSERT/UPDATE/DELETE ──
DO $$
DECLARE
  pol RECORD;
  dropped_count int := 0;
BEGIN
  FOR pol IN
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND cmd IN ('INSERT','UPDATE','DELETE')
      AND 'anon' = ANY(roles)
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
    dropped_count := dropped_count + 1;
  END LOOP;
  RAISE NOTICE 'Dropped % anon INSERT/UPDATE/DELETE policies', dropped_count;
END $$;

-- ── Étape 2: activer RLS sur les tables exposées sans filtre ──
-- Sans RLS, les grants table-level laissent anon écrire. Avec RLS
-- activé + aucune policy d'écriture pour anon = anon bloqué.
ALTER TABLE public.recipes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stores   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prices   ENABLE ROW LEVEL SECURITY;

-- Vérifie que les policies SELECT anon existantes (anon_select_recipes,
-- anon_select_stores, etc.) continuent d'assurer la lecture publique.
-- Pour `prices` et `products`, pas de policy SELECT anon → anon ne verra
-- plus rien. Ajouter explicitement un read public:
DROP POLICY IF EXISTS "public_read" ON public.prices;
CREATE POLICY "public_read" ON public.prices
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "public_read" ON public.products;
CREATE POLICY "public_read" ON public.products
  FOR SELECT TO anon, authenticated
  USING (true);
