# 🚀 Guide de Migration OnSpace Cloud → Supabase

## Vue d'ensemble

Ce guide te permettra de migrer **RecettesMalin (Bon Plan)** d'OnSpace Cloud vers Supabase en ~30 minutes.

---

## 📋 Checklist avant de commencer

- [ ] Compte Supabase actif (tu en as déjà un ✅)
- [ ] Accès à ton backend OnSpace Cloud actuel
- [ ] Supabase CLI installé (optionnel, pour Edge Functions)
- [ ] Fichier `migration-schema.sql` (généré ci-dessous)

---

## Étape 1 : Créer un nouveau projet Supabase

1. Va sur [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Clique sur **"New Project"**
3. Choisis :
   - **Organization** : Ton workspace existant
   - **Name** : `RecettesMalin` (ou ce que tu veux)
   - **Database Password** : Génère un mot de passe fort (GARDE-LE EN SÉCURITÉ)
   - **Region** : `Canada (Central Canada)` (recommandé pour le Québec)
4. Clique sur **"Create new project"**
5. Attends 1-2 minutes que le projet soit prêt

---

## Étape 2 : Récupérer les credentials Supabase

Une fois le projet créé :

1. Va dans **Settings** → **API**
2. Note ces 2 valeurs (tu en auras besoin) :

```
Project URL : https://xxxxxxxxxxxxx.supabase.co
anon public : eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## Étape 3 : Importer le schéma de la base de données

### Option A : Via l'interface Supabase (recommandé)

1. Va dans **SQL Editor** dans ton projet Supabase
2. Clique sur **"New query"**
3. Copie-colle le contenu du fichier `migration-schema.sql` (voir ci-dessous)
4. Clique sur **"Run"**
5. Attends que toutes les tables, fonctions et policies soient créées

### Option B : Via psql (si tu es à l'aise avec le terminal)

```bash
psql "postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres" < migration-schema.sql
```

---

## Étape 4 : Activer Row Level Security (RLS)

Pour chaque table, active RLS :

```sql
-- Exécute ce script dans SQL Editor
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredient_product_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredient_conversions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredient_exclusion_keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredient_inclusion_keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_exclusions ENABLE ROW LEVEL SECURITY;
ALTER TABLE scraping_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotion_urls ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_members ENABLE ROW LEVEL SECURITY;
```

---

## Étape 5 : Créer les Storage Buckets

1. Va dans **Storage** dans Supabase
2. Clique sur **"Create a new bucket"**
3. Crée 2 buckets :

### Bucket 1 : `avatars`
- **Name** : `avatars`
- **Public** : ✅ Coché
- Clique sur **"Create bucket"**

Puis ajoute les RLS policies :

```sql
-- Policy 1 : Lecture publique
CREATE POLICY "public_read_avatars"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');

-- Policy 2 : Upload par utilisateurs authentifiés
CREATE POLICY "authenticated_upload_avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 3 : Mise à jour par propriétaire
CREATE POLICY "authenticated_update_avatars"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);
```

### Bucket 2 : `recipe-images`
- **Name** : `recipe-images`
- **Public** : ✅ Coché
- Clique sur **"Create bucket"**

Puis ajoute les RLS policies :

```sql
-- Policy 1 : Lecture publique
CREATE POLICY "public_read_recipe_images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'recipe-images');

-- Policy 2 : Upload par utilisateurs authentifiés
CREATE POLICY "authenticated_upload_recipe_images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'recipe-images');

-- Policy 3 : Suppression par utilisateurs authentifiés
CREATE POLICY "authenticated_delete_recipe_images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'recipe-images');
```

---

## Étape 6 : Configurer l'authentification

1. Va dans **Authentication** → **Providers**
2. Configure les providers :

### Email (déjà activé par défaut)
- **Enable Email provider** : ✅
- **Confirm email** : ❌ Désactivé (auto-confirmation)
- **Secure email change** : ✅

### Google OAuth (si tu veux garder cette fonctionnalité)
- **Enable Google provider** : ✅
- **Client ID** : [TON_GOOGLE_CLIENT_ID]
- **Client Secret** : [TON_GOOGLE_CLIENT_SECRET]

---

## Étape 7 : Migrer les données existantes

### Option A : Export/Import manuel (petit volume)

Si tu as peu de données (< 1000 lignes) :

1. Exporte depuis OnSpace via SQL :
```sql
COPY (SELECT * FROM products) TO STDOUT WITH CSV HEADER;
COPY (SELECT * FROM recipes) TO STDOUT WITH CSV HEADER;
-- etc.
```

2. Importe dans Supabase via l'interface **Table Editor** ou SQL :
```sql
COPY products FROM '/path/to/products.csv' WITH CSV HEADER;
```

### Option B : Script de migration (recommandé pour grand volume)

Je peux te créer un script Node.js qui copie automatiquement toutes les données d'OnSpace → Supabase.

---

## Étape 8 : Redéployer les Edge Functions

Tu as 40+ Edge Functions à redéployer. Voici le process :

### 8.1 Installer Supabase CLI

```bash
npm install -g supabase
```

### 8.2 Login

```bash
supabase login
```

### 8.3 Lier ton projet

```bash
supabase link --project-ref [TON_PROJECT_REF]
```

### 8.4 Déployer toutes les fonctions

```bash
supabase functions deploy
```

Cela déploiera automatiquement toutes les fonctions dans `supabase/functions/`.

### 8.5 Configurer les secrets

```bash
supabase secrets set RESEND_API_KEY=[ta_clé]
supabase secrets set FIRECRAWL_API_KEY=[ta_clé]
supabase secrets set STRIPE_SECRET_KEY=[ta_clé]
supabase secrets set SERPAPI_KEY=[ta_clé]
# etc.
```

---

## Étape 9 : Mettre à jour l'application mobile

### 9.1 Modifier `.env`

Remplace les variables OnSpace par Supabase :

```env
EXPO_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 9.2 Tester localement

```bash
npm start
```

Teste :
- ✅ Connexion / Inscription
- ✅ Chargement des recettes
- ✅ Liste de courses
- ✅ Menu hebdomadaire
- ✅ Circulaires

---

## Étape 10 : Mettre à jour le portail admin

1. Ouvre le portail admin (`admin-portal.html`)
2. Clique sur **Paramètres**
3. Entre les nouvelles credentials Supabase :
   - **URL** : `https://xxxxxxxxxxxxx.supabase.co`
   - **ANON_KEY** : `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
4. Teste l'import CSV et les opérations CRUD

---

## Étape 11 : Tests finaux

### Checklist de validation

- [ ] Signup/Login fonctionne
- [ ] Les recettes s'affichent avec prix
- [ ] Ajout au menu hebdomadaire
- [ ] Liste de courses
- [ ] Circulaires et deals
- [ ] Upload d'images (recettes, avatars)
- [ ] Edge Functions répondent (scraping, classification)
- [ ] Portail admin opérationnel
- [ ] CSV import/export fonctionnel

---

## 🎉 C'est terminé !

Ton application est maintenant sur Supabase avec :
- ✅ Backend stable et performant
- ✅ Pas de bugs PGRST200/PGRST002
- ✅ Infrastructure fiable
- ✅ Support réactif

---

## 🆘 En cas de problème

**Support Supabase :**
- Discord : [https://discord.supabase.com](https://discord.supabase.com)
- Email : support@supabase.io
- Docs : [https://supabase.com/docs](https://supabase.com/docs)

**Support IA (moi) :**
- Si un truc bloque pendant la migration, envoie-moi l'erreur et je t'aide immédiatement ! 🚀
