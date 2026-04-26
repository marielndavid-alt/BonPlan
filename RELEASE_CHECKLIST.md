# BonPlan — Release Checklist

Document préparé pour la soumission App Store + Google Play.

## 🟢 Ce qui est fait côté code

- [x] `app.json` configuré avec icônes correctes (1024×1024)
- [x] iOS `bundleIdentifier`: `co.bonplan.app`
- [x] iOS `buildNumber`: `1`
- [x] iOS permissions caméra/photos déclarées (`NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription`)
- [x] Android `package`: `co.bonplan.app`
- [x] Android `versionCode`: `1`
- [x] Android permissions déclarées (CAMERA, READ/WRITE_EXTERNAL_STORAGE)
- [x] RevenueCat clé Apple en env var (`appl_sjHctCESxpKdlVKyAiwfsNtkcsn`)
- [x] Splash screen + notifications icon configurés
- [x] Apple Sign In activé (`usesAppleSignIn: true`)
- [x] EAS project ID configuré
- [x] Bugs subscription corrigés (R22, R23, R24)

## 🚨 SÉCURITÉ — À FAIRE IMMÉDIATEMENT

- [ ] **Rotation de la clé Anthropic** — la clé `sk-ant-api03-...` était dans `eas.json` (commitée publiquement). Elle doit être révoquée sur https://console.anthropic.com et remplacée. Une nouvelle clé devrait être stockée comme **EAS Secret** (pas dans `eas.json`), ou idéalement déplacée vers une Edge Function Supabase pour ne plus exposer la clé côté client.
- [ ] **Long terme** : déplacer `classifyProductWithAI` (dans `app/(tabs)/shopping.tsx`) vers une Edge Function Supabase pour ne plus exposer la clé Anthropic côté client mobile

## 🟠 R3 — RevenueCat (4-6h)

À faire dans le dashboard RevenueCat (https://app.revenuecat.com) + App Store Connect:

### Côté App Store Connect
- [ ] Créer un **Auto-Renewable Subscription Group** (ex: "BonPlan Pro")
- [ ] Créer le produit **monthly** (`bonplan_monthly`): 5,00 $ CAD, 7 jours d'essai gratuit
- [ ] Créer le produit **yearly** (`bonplan_yearly`): 50,00 $ CAD, 7 jours d'essai gratuit
- [ ] Soumettre les produits pour review (peut prendre 24-48h)
- [ ] Créer un **Sandbox Tester** pour tester l'achat (Settings → Users → Sandbox Testers)

### Côté RevenueCat
- [ ] Linker les 2 produits App Store dans le projet RevenueCat
- [ ] Créer l'**entitlement** appelé exactement `Bon Plan Pro` (le code l'utilise hardcodé dans `services/revenueCatService.ts:5`)
- [ ] Attacher les 2 produits à cet entitlement
- [ ] Créer une **Offering** (ex: `default`) avec les 2 packages (monthly, yearly)
- [ ] Marquer cette offering comme "current"

### Test
- [ ] Sur un iPhone physique (sandbox tester signed in via Settings → App Store → Sandbox Account)
- [ ] Lancer le dev build, ouvrir l'onglet Recettes/Liste/Menu
- [ ] Tap "Commencer l'essai gratuit" → la feuille d'achat iOS doit s'ouvrir
- [ ] Compléter l'achat sandbox (gratuit) → vérifier que `subscriptions.status='trialing'` apparaît dans Supabase

## 🟠 R16 — Soumission App Store (6-9h)

### Pré-requis (compte)
- [ ] Compte Apple Developer actif (99 USD/an) — https://developer.apple.com
- [ ] Accès à App Store Connect — https://appstoreconnect.apple.com
- [ ] Pour build sans Mac: compte EAS (gratuit jusqu'à ~30 builds/mois)

### Build EAS sans Mac
```bash
cd bonplan-mobile
npm i -g eas-cli
eas login
eas build --platform ios --profile production
```
- [ ] EAS demande le bundle ID, distribution certificate, provisioning profile — laisser EAS gérer automatiquement
- [ ] Une fois le build prêt (15-20 min), récupérer le `.ipa`

### Métadonnées App Store Connect
- [ ] **Nom de l'app**: BonPlan
- [ ] **Sous-titre** (30 chars max): _ex: "Économisez sur vos courses"_
- [ ] **Description** (4000 chars max): _à rédiger — voir template ci-dessous_
- [ ] **Mots-clés** (100 chars): _ex: "épicerie,recettes,promotions,québec,économies,menu,courses,iga,metro"_
- [ ] **URL support**: _ex: https://bonplan.co/support_
- [ ] **URL marketing**: _ex: https://bonplan.co_
- [ ] **URL privacy policy**: **OBLIGATOIRE** — _voir section Privacy ci-dessous_
- [ ] **Catégorie primaire**: Food & Drink
- [ ] **Catégorie secondaire**: Lifestyle
- [ ] **Âge**: 4+
- [ ] **Copyright**: BonPlan 2026

### Screenshots (OBLIGATOIRES)
Toutes les tailles requises pour iOS:
- [ ] **iPhone 6.9"** (iPhone 16 Pro Max): 1290×2796 — **3 screenshots minimum**
- [ ] **iPhone 6.5"** (iPhone 14 Plus): 1284×2778 — **3 screenshots minimum**
- [ ] **iPad 13"** (optionnel mais recommandé si supportsTablet=true): 2064×2752

Outils pour générer: https://www.appmockup.com/ ou Figma.

### Soumission
- [ ] Upload du `.ipa` via Transporter (Mac) OU **EAS Submit** (sans Mac):
  ```bash
  eas submit --platform ios
  ```
- [ ] Build apparaît dans App Store Connect (10-30 min)
- [ ] Lier le build à la release dans App Store Connect
- [ ] **Soumettre pour review** — Apple répond en 24-72h en moyenne

## 🟠 R17 — Soumission Google Play (5-8h)

### Pré-requis
- [ ] Compte Google Play Console (25 USD une fois) — https://play.google.com/console
- [ ] Compte EAS pour build sans Android Studio

### Build EAS
```bash
eas build --platform android --profile production
```
Récupère un `.aab` (Android App Bundle).

### Métadonnées Play Store
- [ ] **Titre**: BonPlan (50 chars max)
- [ ] **Description courte**: 80 chars max
- [ ] **Description complète**: 4000 chars max — peut réutiliser la description App Store
- [ ] **Catégorie**: Food & Drink
- [ ] **Tags**: épicerie, recettes, promotions
- [ ] **Email de contact**: support@bonplan.co (ou autre)
- [ ] **URL Privacy Policy**: même que App Store
- [ ] **Public cible**: 13+ (ou 4+ selon préférence)

### Graphics
- [ ] **Icône haute résolution**: 512×512 PNG
- [ ] **Image de fond (feature graphic)**: 1024×500 JPG/PNG
- [ ] **Screenshots téléphone**: minimum 2, maximum 8 — 1080×1920 recommandé
- [ ] **Screenshots tablette** (si supporté): 7" et 10"

### Soumission
- [ ] Upload du `.aab` via Play Console OU **EAS Submit**:
  ```bash
  eas submit --platform android
  ```
- [ ] Compléter la **Data Safety** form (Play Console exige)
- [ ] Compléter le **Content Rating questionnaire**
- [ ] Soumettre pour Internal Testing → Closed Testing → Production
- [ ] Review Google: quelques heures à quelques jours

## 📜 Privacy Policy (OBLIGATOIRE pour les 2 stores)

L'app collecte:
- Email (auth Supabase)
- Code postal (recommandations)
- Composition du foyer (préférences)
- Liste d'épicerie (données utilisateur)
- Image de profil (optionnel)
- Token de notifications push

**Action**: rédiger une page privacy policy hébergée sur https://bonplan.co/privacy ou similaire. Template gratuit: https://app-privacy-policy-generator.firebaseapp.com/

## 📝 Description App Store / Play Store — Template à compléter

```
BonPlan — Économisez sur votre épicerie au Québec

Découvrez les meilleures promotions de la semaine dans 5 épiceries du Québec
(Metro, IGA, Super C, Maxi, Walmart) et planifiez vos repas autour des prix
les plus bas.

✓ Recettes économiques par épicerie, mises à jour chaque semaine
✓ Liste d'épicerie intelligente avec total en temps réel
✓ Menu hebdomadaire par glisser-déposer
✓ Comparaison des prix entre toutes les épiceries
✓ Économisez en moyenne 1 250 $ par année

Avec BonPlan Premium (4,99 $/mois ou 50 $/an, 7 jours d'essai gratuit), accédez
aux recettes optimisées, à la liste d'épicerie connectée et au planificateur
de menus.

Sans abonnement, consultez gratuitement les circulaires et les rabais de
toutes les épiceries.

Fait au Québec 🍁
```

## 🚀 Ordre suggéré

1. **Aujourd'hui**: Rotation clé Anthropic (5 min) + privacy policy (1h)
2. **Demain**: R3 RevenueCat (4-6h, partagé entre App Store Connect + RevenueCat dashboard)
3. **Quand R3 est testé OK**: R16 (App Store) + R17 (Play Store) en parallèle (~6-8h chacun)

L'App Store review prend 24-72h, donc soumettre tôt pour que ça passe avant la date prévue de lancement.
