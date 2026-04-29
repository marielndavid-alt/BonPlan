# Setup abonnement iOS — Runbook pour Marie

Ce document décrit les étapes côté Apple, RevenueCat et Stripe que je n'ai pas
pu faire seul (besoin de tes accès / d'un iPhone). Une fois ces étapes faites,
l'abonnement iOS et la synchro avec Supabase tournent en autonomie.

Le code, le webhook RevenueCat, le webhook Stripe, les migrations DB et la config
EAS sont déjà en place.

---

## A. Apple — créer le compte développeur et l'app (45 min – 24h pour activation)

1. **Apple Developer Program** — `developer.apple.com/programs/enroll/`
   - 99 USD / an
   - Demande passport + numéro de carte
   - Validation Apple : 24-48h
2. **App Store Connect** — `appstoreconnect.apple.com`
   - My Apps → "+" → New App
   - Platform : iOS
   - Bundle ID : **`co.bonplan.app`** (exact, doit matcher `app.json`)
   - Primary language : Français (Canada)
   - SKU : libre (ex : `bonplan-ios-1`)
3. **Agreements, Tax, Banking**
   - Profile (en haut à droite) → Agreements, Tax, and Banking
   - Sign **Paid Apps Agreement** (sinon les abonnements sont bloqués)
   - Tax Forms : remplir W-8BEN ou équivalent
   - Banking : compte de réception des paiements
4. **Apple Team ID**
   - Profile → "View Membership" → noter le **Team ID** (10 caractères)
   - À mettre dans `eas.json` → `submit.production.ios.appleTeamId`

---

## B. App Store Connect — produits d'abonnement (30 min)

5. ASC → My Apps → BonPlan → **Subscriptions** (menu gauche)
6. Créer un **Subscription Group** : `Bon Plan Pro`
7. Créer 2 produits dans ce groupe :
   - **Mensuel** :
     - Product ID : `bonplan_monthly_5` (à confirmer avec ce qu'on choisit dans RevenueCat)
     - Reference name : `Mensuel 5$`
     - Subscription duration : 1 month
     - Price : 5,00 CAD
     - Localizations : nom français "Mensuel"
     - **Introductory Offer** : Free Trial 7 days
   - **Annuel** :
     - Product ID : `bonplan_yearly_50`
     - Reference name : `Annuel 50$`
     - Subscription duration : 1 year
     - Price : 50,00 CAD
     - Localizations : nom français "Annuel"
     - Introductory Offer : Free Trial 7 days
8. **Soumettre** les 2 produits pour review (Apple les approuve avec la première soumission de l'app)

---

## C. App Store Server Notifications V2 → RevenueCat (CRITIQUE — facile à oublier)

9. ASC → My Apps → BonPlan → **App Information** (menu gauche)
10. Section **App Store Server Notifications**
    - Production Server URL : (RevenueCat te donne cette URL — voir étape 13)
    - Sandbox Server URL : même URL
    - Version : V2

> **Sans cette étape**, RevenueCat ne reçoit aucun événement Apple → notre webhook
> ne reçoit rien → l'utilisateur paie mais Supabase ne le sait jamais.

---

## D. RevenueCat dashboard — `app.revenuecat.com` (30 min)

11. Project Settings → **Apps** → New iOS app
    - Bundle ID : `co.bonplan.app`
    - **App-Specific Shared Secret** (généré dans ASC → My Apps → BonPlan → App Information → "Manage" sous Subscription Key)
    - **In-App Purchase Key** (.p8) : ASC → Users and Access → Integrations → In-App Purchase → "+"
12. Products → Import les 2 produits depuis App Store Connect
13. **Entitlements** → créer `Bon Plan Pro` (NOM EXACT, espace inclus, casse exacte)
    - Attacher les 2 produits à cet entitlement
14. **Offerings** → Default Offering :
    - Package `$rc_monthly` → produit Mensuel
    - Package `$rc_annual` → produit Annuel
15. **Project Settings → API keys** → copier la **Public iOS SDK key**
    - La coller dans `eas.json` → `build.production.env.EXPO_PUBLIC_REVENUECAT_APPLE_KEY`
    - (La clé actuelle `appl_sjHctCESxpKdlVKyAiwfsNtkcsn` est probablement déjà la bonne, à vérifier)
16. **Integrations → Webhooks** :
    - URL : `https://wurvstyckmuktgapqstm.supabase.co/functions/v1/revenuecat-webhook`
    - Authorization header value : génère une chaîne aléatoire (ou utilise celle ci-dessous) → tu la pasteras aussi côté Supabase à l'étape suivante
    - **Active toutes les events**
17. Copie l'Authorization header value de l'étape précédente. Va sur :
    `https://supabase.com/dashboard/project/wurvstyckmuktgapqstm/settings/functions`
    → **Edge Function Secrets** → ajoute :
    - Key : `REVENUECAT_WEBHOOK_SECRET`
    - Value : (la valeur de l'étape 16)
18. Récupère aussi l'URL du webhook RevenueCat (Integrations → Apple Server Notifications → URL fournie par RC) et colle-la à l'étape 10 (ASC App Store Server Notifications).

---

## E. Stripe — webhook synchro abonnements (10 min)

> Même bug que côté iOS : sans webhook, les abonnements Stripe payés ne mettent
> jamais à jour `subscriptions.status` dans Supabase, donc le RLS paywall continue
> à bloquer même les payants.

19. Stripe Dashboard → **Developers → Webhooks → Add endpoint**
    - URL : `https://wurvstyckmuktgapqstm.supabase.co/functions/v1/stripe-webhook`
    - Events to listen :
      - `checkout.session.completed`
      - `customer.subscription.created`
      - `customer.subscription.updated`
      - `customer.subscription.deleted`
      - `customer.subscription.resumed`
      - `invoice.payment_failed`
      - `invoice.payment_succeeded`
20. Copie le **Signing secret** (commence par `whsec_…`)
21. Supabase Dashboard → Edge Function Secrets → `STRIPE_WEBHOOK_SECRET` = (signing secret)
    - Note : un secret du même nom existe déjà — vérifie qu'il pointe bien vers ce nouveau webhook (ou écrase-le)

---

## F. Build, soumission TestFlight, test sandbox (1-2h)

22. **`eas.json`** : remplace les `REPLACE_ME_*` dans `submit.production.ios` :
    - `appleId` : ton email Apple Developer
    - `ascAppId` : trouvé dans ASC → My Apps → BonPlan → App Information → Apple ID (numérique, ~10 chiffres)
    - `appleTeamId` : étape 4
23. **Build iOS** depuis Windows (pas besoin de Mac) :
    ```bash
    eas build --platform ios --profile production
    ```
    - 15-25 min
    - EAS gère certificats et profils auto si tu loggues à Apple Dev quand demandé
24. **Submit vers App Store Connect** :
    ```bash
    eas submit --platform ios --latest
    ```
    - 5 min (upload) + 20-30 min (Apple processing)
25. ASC → TestFlight → la build apparaît
    - Internal Testing → ajoute toi-même comme testeur
    - Tu reçois un email d'invitation avec un lien pour installer via TestFlight (sur l'iPhone)
26. **Sandbox tester** :
    - ASC → Users and Access → Sandbox → Testers → "+"
    - Crée un faux email (ex : `bonplan-sandbox-1@bonplan.co`) avec un mot de passe simple
27. **Sur l'iPhone** :
    - Réglages → App Store → Sandbox Account → log in avec le sandbox tester
    - Ouvre BonPlan via TestFlight
    - Test : "Commencer l'essai gratuit"
    - L'écran Apple "S'abonner" apparaît, confirme avec Touch ID / Face ID
    - Vérifie dans l'app que l'écran paywall disparaît et tu vois les recettes

---

## G. Vérifier que tout est connecté (10 min)

Après l'étape 27, fais une requête de vérification depuis n'importe où (curl, navigateur, Supabase SQL editor) :

```sql
SELECT user_id, status, provider, current_period_end, last_event_at_ms
FROM public.subscriptions
ORDER BY updated_at DESC
LIMIT 5;
```

Tu devrais voir une row avec ton sandbox user_id, `status = 'trialing'`, `provider = 'revenuecat'`. Si oui, **tout fonctionne en bout en bout**.

Si la row n'apparaît pas :
- Check `https://supabase.com/dashboard/project/wurvstyckmuktgapqstm/functions/revenuecat-webhook/logs` — chercher l'event reçu
- Check RC dashboard → Integrations → Webhooks → Delivery History — tous les calls doivent être 200
- Si 401 → le `REVENUECAT_WEBHOOK_SECRET` Supabase ne matche pas l'Authorization header RC

---

## En cas de problème : qui contacter

Tu peux me ping (Ayman) à toute étape — surtout si :
- Apple rejette la soumission (souvent cosmétique : description, screenshots)
- Le webhook 401 ou 500 (les logs Supabase me disent quoi)
- Un produit "n'apparaît pas" dans l'app après achat (souvent le nom de l'entitlement
  qui ne matche pas — voir étape 13, ça doit être **`Bon Plan Pro`** exactement)
