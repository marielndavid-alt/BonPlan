# Backend audit — Bonplan Supabase

Status: **template to be filled during live Supabase session**
Owner: Ayman
Scope: prerequisite for sheet rows 3 (iOS subscription), 10 (Thursday cron), 15 (RLS paywall)

Method: read-only via Supabase dashboard + SQL editor. No writes.

---

## 1. `recipe_weekly_schedule`

Mobile app queries this table at `services/optimizedRecipeService.ts:13-48` but it is **not defined** in `supabase-schema.sql`. Verify live state:

```sql
-- Schema
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'recipe_weekly_schedule'
ORDER BY ordinal_position;

-- Indexes / constraints
SELECT indexname, indexdef FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'recipe_weekly_schedule';

-- RLS
SELECT polname, polcmd, pg_get_expr(polqual, polrelid) AS using_expr
FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
WHERE c.relname = 'recipe_weekly_schedule';
```

Findings:
- Columns observed: _fill in_
- UNIQUE (recipe_id, week_start) present? _y/n_
- RLS enabled? policies? _fill in_
- Row count / oldest week_start / latest week_start: _fill in_

→ Decides whether `supabase/migrations/20260423_recipe_weekly_schedule.sql` needs only `CREATE IF NOT EXISTS` (current draft) or an additional `ALTER TABLE` to add the missing constraint.

---

## 2. `pg_cron`

Needed for row 10 (Thursday 1 AM scrape → 7 AM generate).

```sql
SELECT * FROM pg_extension WHERE extname = 'pg_cron';
SELECT jobid, schedule, command, active FROM cron.job;
```

Findings:
- `pg_cron` enabled? _y/n_
- Existing jobs: _fill in_
- Alternative needed? (Supabase Scheduler + Edge Function) _y/n_

---

## 3. RLS state on sensitive tables

```sql
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('recipes','recipe_store_prices','recipe_ingredient_prices',
                    'subscriptions','user_subscriptions','entitlements',
                    'prices','products','promotions','stores','pantry_items',
                    'weekly_menus','recipe_weekly_schedule');
```

Findings (table → rls_enabled / read policy / write policy):
- recipes: _fill in_
- recipe_store_prices: _fill in_
- recipe_ingredient_prices: _fill in_
- subscriptions: _fill in_
- weekly_menus: _fill in_
- pantry_items: _fill in_

→ Row 15 plan: any table currently missing RLS gets a `USING (auth.uid() = user_id)` (for user-scoped tables) or a server-side-only write policy (for catalog tables).

---

## 4. Subscription source of truth

Row 3 (iOS fix) and row 15 (server-side paywall) both depend on where subscription state lives.

```sql
-- Find any table that looks subscription-shaped
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND (table_name ILIKE '%subscript%' OR table_name ILIKE '%entitle%' OR table_name ILIKE '%revenu%');
```

Also check client-side code references: `services/revenueCatService.ts`, `services/subscriptionService.ts`.

Findings:
- Table name: _fill in_
- Columns (user_id, product_id, expires_at, is_active, rc_entitlement_id, …): _fill in_
- Populated by: webhook from RevenueCat? Edge Function? Client upsert? _fill in_

→ Row 3 action: if state lives in RevenueCat only and not mirrored to Supabase, add the webhook.
→ Row 15 action: add RLS + server-side `is_subscribed(auth.uid())` function used by sensitive SELECT policies.

---

## 5. Deployed Edge Functions

Local source (committed) has 4: `apply-referral-credit`, `create-checkout-session`, `send-household-invitation`, `stripe-checkout`. Verify against prod:

```
npx supabase functions list   # requires linked project
```

Findings:
- Prod functions beyond the local 4: _fill in_
- Any that are stale vs local source: _fill in_

→ Pre-flight for row 10 (we'll add a new scheduled Edge Function `generate-weekly-menu`).

---

## Questions to confirm with Marie-Hélène

1. Supabase project ref & access — confirm Ayman has dashboard + SQL editor access.
2. Target timezone for the "week" — `America/Toronto` assumed (migration uses it). Confirm it matches the web app's server locale.
3. Where do subscription receipts get written today? RevenueCat → ? → Supabase?
4. Production vs staging — is there a staging Supabase project we apply migrations to first, or prod only?

---

## Web app repo — aligned follow-up

Mobile-side fix for row 4 ships today. The web repo (HTML/JS against same Supabase) is not in this working tree; Ayman was added as collaborator on GitHub. Once cloned:

- Search the web code for the same `getDay()` / week-start calculation.
- Replace with `supabase.rpc('current_week_start')`.
- Same `onConflict` behavior on insert if the web also writes to `recipe_weekly_schedule`.
