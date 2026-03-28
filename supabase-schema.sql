-- ============================================================
-- RecettesMalin - Schéma Supabase complet
-- À exécuter dans l'éditeur SQL de Supabase
-- ============================================================

-- ─── Extensions ───────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ─── Tables principales ────────────────────────────────────────

-- Profils utilisateurs
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  username TEXT,
  avatar_url TEXT,
  postal_code TEXT,
  phone TEXT,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Préférences utilisateurs
CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  household_adults INTEGER DEFAULT 2,
  household_children INTEGER DEFAULT 0,
  dietary_restrictions TEXT[] DEFAULT ARRAY[]::TEXT[],
  excluded_ingredients TEXT[] DEFAULT ARRAY[]::TEXT[],
  selected_stores TEXT[] DEFAULT ARRAY['metro']::TEXT[],
  notifications_enabled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Abonnements
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  status TEXT DEFAULT 'inactive',
  -- status: 'trialing' | 'active' | 'canceled' | 'past_due' | 'inactive'
  trial_start TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Produits (ingrédients)
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  brand TEXT,
  category TEXT,
  unit TEXT DEFAULT 'unité',
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_products_name ON products USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);

-- Prix des produits par magasin
CREATE TABLE IF NOT EXISTS prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  store_code TEXT NOT NULL,
  -- store_code: 'metro' | 'iga' | 'superc' | 'maxi' | 'walmart' | 'loblaws' | 'avril' | 'rachelle'
  price DECIMAL(10,2) NOT NULL,
  unit TEXT,
  per_unit_price DECIMAL(10,4),
  scraped_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_prices_product_store ON prices(product_id, store_code);
CREATE INDEX IF NOT EXISTS idx_prices_store ON prices(store_code);

-- Recettes
CREATE TABLE IF NOT EXISTS recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  image TEXT,
  category TEXT DEFAULT 'main',
  -- category: 'main' | 'snack'
  prep_time INTEGER DEFAULT 30,
  servings INTEGER DEFAULT 4,
  difficulty TEXT,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  instructions TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_recipes_category ON recipes(category);
CREATE INDEX IF NOT EXISTS idx_recipes_tags ON recipes USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_recipes_title ON recipes USING gin(title gin_trgm_ops);

-- Ingrédients des recettes (lien recette ↔ produit)
CREATE TABLE IF NOT EXISTS recipe_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID REFERENCES recipes(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  quantity DECIMAL(10,2),
  unit TEXT,
  notes TEXT,
  optional BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_ri_recipe ON recipe_ingredients(recipe_id);
CREATE INDEX IF NOT EXISTS idx_ri_product ON recipe_ingredients(product_id);

-- Menu hebdomadaire par utilisateur
CREATE TABLE IF NOT EXISTS weekly_menus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  recipe_id UUID REFERENCES recipes(id) ON DELETE CASCADE,
  title TEXT,
  day TEXT,
  -- day: 'Lundi' | 'Mardi' | 'Mercredi' | 'Jeudi' | 'Vendredi' | 'Samedi' | 'Dimanche'
  servings INTEGER DEFAULT 4,
  total_price DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wm_user ON weekly_menus(user_id);

-- Liste d'épicerie
CREATE TABLE IF NOT EXISTS shopping_list_items (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity TEXT DEFAULT '1',
  unit TEXT DEFAULT 'unité',
  price DECIMAL(10,2) DEFAULT 0,
  store TEXT DEFAULT '',
  checked BOOLEAN DEFAULT FALSE,
  category TEXT DEFAULT 'produce',
  -- category: 'frozen' | 'pantry' | 'produce' | 'dairy' | 'meat' | 'fish'
  note TEXT,
  photo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sli_user ON shopping_list_items(user_id);

-- Garde-manger
CREATE TABLE IF NOT EXISTS pantry_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity DECIMAL(10,2),
  unit TEXT,
  expiry_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pantry_user ON pantry_items(user_id);

-- Membres du foyer
CREATE TABLE IF NOT EXISTS household_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  member_email TEXT NOT NULL,
  member_name TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(owner_id, member_email)
);

-- Promotions hebdomadaires (circulaires)
CREATE TABLE IF NOT EXISTS promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_code TEXT NOT NULL,
  store_name TEXT,
  product_name TEXT NOT NULL,
  original_price DECIMAL(10,2),
  sale_price DECIMAL(10,2),
  discount_percentage DECIMAL(5,2),
  unit TEXT,
  image_url TEXT,
  product_category TEXT,
  -- product_category (standardisé AI): 'viandes', 'poissons et fruits de mer', 'légumes', 
  -- 'fruits', 'produits laitiers', 'garde-manger', 'boissons', 'boulangerie', 'surgelés',
  -- 'hygiène et beauté', 'entretien ménager'
  valid_from DATE,
  valid_to DATE,
  scraped_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_promotions_store ON promotions(store_code);
CREATE INDEX IF NOT EXISTS idx_promotions_valid_to ON promotions(valid_to);
CREATE INDEX IF NOT EXISTS idx_promotions_category ON promotions(product_category);

-- ─── Vues ─────────────────────────────────────────────────────

-- Vue principale: recettes avec meilleur prix par magasin
CREATE OR REPLACE VIEW recipes_with_best_store AS
WITH recipe_costs AS (
  SELECT
    ri.recipe_id,
    p_price.store_code,
    SUM(
      ri.quantity * COALESCE(
        (
          SELECT price
          FROM prices pr
          WHERE pr.product_id = ri.product_id
            AND pr.store_code = p_price.store_code
          ORDER BY pr.scraped_at DESC
          LIMIT 1
        ),
        0
      )
    ) AS total_price
  FROM recipe_ingredients ri
  CROSS JOIN (SELECT DISTINCT store_code FROM prices) p_price
  GROUP BY ri.recipe_id, p_price.store_code
),
best_costs AS (
  SELECT DISTINCT ON (recipe_id)
    recipe_id,
    store_code AS best_store,
    total_price
  FROM recipe_costs
  WHERE total_price > 0
  ORDER BY recipe_id, total_price ASC
)
SELECT
  r.id,
  r.title,
  r.description,
  r.image,
  r.category,
  r.prep_time,
  r.servings,
  r.difficulty,
  r.tags,
  r.instructions,
  r.created_at,
  COALESCE(bc.best_store, 'N/A') AS best_store,
  COALESCE(bc.total_price, 0) AS total_price
FROM recipes r
LEFT JOIN best_costs bc ON r.id = bc.recipe_id;

-- ─── Fonctions et Triggers ────────────────────────────────────

-- Auto-créer un profil après inscription
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_profiles (id, email, username)
  VALUES (
    NEW.id,
    NEW.email,
    SPLIT_PART(NEW.email, '@', 1)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ─── Row Level Security (RLS) ────────────────────────────────

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE pantry_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;

-- user_profiles: chaque user voit seulement son profil
DROP POLICY IF EXISTS "Users see own profile" ON user_profiles;
CREATE POLICY "Users see own profile" ON user_profiles
  FOR ALL USING (auth.uid() = id);

-- user_preferences: chaque user gère ses préférences
DROP POLICY IF EXISTS "Users manage own preferences" ON user_preferences;
CREATE POLICY "Users manage own preferences" ON user_preferences
  FOR ALL USING (auth.uid() = user_id);

-- subscriptions: chaque user voit son abonnement
DROP POLICY IF EXISTS "Users see own subscription" ON subscriptions;
CREATE POLICY "Users see own subscription" ON subscriptions
  FOR ALL USING (auth.uid() = user_id);

-- weekly_menus: chaque user gère son menu
DROP POLICY IF EXISTS "Users manage own menu" ON weekly_menus;
CREATE POLICY "Users manage own menu" ON weekly_menus
  FOR ALL USING (auth.uid() = user_id);

-- shopping_list_items: chaque user gère sa liste
DROP POLICY IF EXISTS "Users manage own shopping list" ON shopping_list_items;
CREATE POLICY "Users manage own shopping list" ON shopping_list_items
  FOR ALL USING (auth.uid() = user_id);

-- pantry_items: chaque user gère son garde-manger
DROP POLICY IF EXISTS "Users manage own pantry" ON pantry_items;
CREATE POLICY "Users manage own pantry" ON pantry_items
  FOR ALL USING (auth.uid() = user_id);

-- household_members: propriétaire gère ses membres
DROP POLICY IF EXISTS "Owner manages household" ON household_members;
CREATE POLICY "Owner manages household" ON household_members
  FOR ALL USING (auth.uid() = owner_id);

-- recipes: lecture publique, écriture admin seulement
DROP POLICY IF EXISTS "Public read recipes" ON recipes;
CREATE POLICY "Public read recipes" ON recipes
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin write recipes" ON recipes;
CREATE POLICY "Admin write recipes" ON recipes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- products: lecture publique pour utilisateurs connectés
DROP POLICY IF EXISTS "Authenticated read products" ON products;
CREATE POLICY "Authenticated read products" ON products
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admin write products" ON products;
CREATE POLICY "Admin write products" ON products
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- prices: lecture publique pour utilisateurs connectés
DROP POLICY IF EXISTS "Authenticated read prices" ON prices;
CREATE POLICY "Authenticated read prices" ON prices
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admin write prices" ON prices;
CREATE POLICY "Admin write prices" ON prices
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- recipe_ingredients: lecture publique
DROP POLICY IF EXISTS "Public read recipe_ingredients" ON recipe_ingredients;
CREATE POLICY "Public read recipe_ingredients" ON recipe_ingredients
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin write recipe_ingredients" ON recipe_ingredients;
CREATE POLICY "Admin write recipe_ingredients" ON recipe_ingredients
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- promotions: lecture publique
DROP POLICY IF EXISTS "Public read promotions" ON promotions;
CREATE POLICY "Public read promotions" ON promotions
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin write promotions" ON promotions;
CREATE POLICY "Admin write promotions" ON promotions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- ─── Données de démonstration ─────────────────────────────────
-- (Optionnel - décommente pour ajouter des données de test)

/*
-- Quelques produits de base
INSERT INTO products (name, category, unit) VALUES
('Poulet entier', 'Viandes', 'kg'),
('Saumon atlantique', 'Poissons', 'kg'),
('Tomates cerises', 'Légumes', '500g'),
('Épinards bébé', 'Légumes', '150g'),
('Pâtes rigatoni', 'Épicerie', '450g'),
('Crème 35%', 'Produits laitiers', '500ml'),
('Parmesan râpé', 'Produits laitiers', '200g'),
('Oignons jaunes', 'Légumes', 'kg'),
('Ail', 'Légumes', 'bulbe'),
('Huile d''olive extra vierge', 'Épicerie', '500ml')
ON CONFLICT DO NOTHING;

-- Quelques recettes de base
INSERT INTO recipes (title, description, category, prep_time, servings, tags) VALUES
('Pâtes à la crème d''ail', 'Recette simple et délicieuse pour les soirs de semaine', 'main', 20, 4, ARRAY['végétarien', 'rapide', 'pâtes']),
('Saumon grillé aux légumes', 'Repas santé riche en oméga-3', 'main', 25, 2, ARRAY['poissons', 'santé', 'sans gluten']),
('Poulet rôti classique', 'Le grand classique du dimanche québécois', 'main', 90, 6, ARRAY['poulet', 'classique', 'famille'])
ON CONFLICT DO NOTHING;
*/

-- ─── Fin du schéma ─────────────────────────────────────────────
-- ✅ Après avoir exécuté ce script:
-- 1. Active l'authentification Email dans Authentication > Providers
-- 2. Désactive "Confirm email" pour faciliter le développement
-- 3. Crée un bucket "avatars" (public) dans Storage
-- 4. Crée un bucket "recipe-images" (public) dans Storage
-- 5. Met ton premier utilisateur comme admin:
--    UPDATE user_profiles SET is_admin = true WHERE email = 'ton@email.com';
