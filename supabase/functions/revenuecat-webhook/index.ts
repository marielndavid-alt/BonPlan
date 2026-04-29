// RevenueCat webhook handler.
// Reçoit les événements de RevenueCat (achat, renouvellement, annulation, etc.)
// et synchronise public.subscriptions pour que le RLS paywall (is_current_user_premium)
// reflète l'état réel de l'abonnement.
//
// Auth: header "Authorization" doit matcher REVENUECAT_WEBHOOK_SECRET (configuré
// dans Supabase Secrets ET dans le dashboard RevenueCat → Integrations → Webhook).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_SECRET = Deno.env.get("REVENUECAT_WEBHOOK_SECRET") || "";

// IMPORTANT: doit matcher exactement l'identifier de l'entitlement dans le
// dashboard RevenueCat. Tout mismatch (espace, casse) = échec silencieux.
const ENTITLEMENT_ID = "Bon Plan Pro";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type RCEventType =
  | "TEST"
  | "INITIAL_PURCHASE"
  | "RENEWAL"
  | "UNCANCELLATION"
  | "CANCELLATION"
  | "EXPIRATION"
  | "BILLING_ISSUE"
  | "PRODUCT_CHANGE"
  | "TRANSFER"
  | "SUBSCRIBER_ALIAS"
  | "NON_RENEWING_PURCHASE";

type RCPeriodType = "TRIAL" | "INTRO" | "NORMAL" | "PROMOTIONAL";

interface RCEvent {
  type: RCEventType;
  app_user_id?: string;
  original_app_user_id?: string;
  period_type?: RCPeriodType;
  expiration_at_ms?: number;
  purchased_at_ms?: number;
  event_timestamp_ms?: number;
  entitlement_ids?: string[];
  id?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // 1. Vérifier l'authentification
  const auth = req.headers.get("Authorization") || "";
  if (!WEBHOOK_SECRET || auth !== WEBHOOK_SECRET) {
    return json({ error: "Unauthorized" }, 401);
  }

  // 2. Parser le body
  let body: { event?: RCEvent };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const event = body.event;
  if (!event || !event.type) {
    return json({ error: "Missing event" }, 400);
  }

  console.log(`[RC Webhook] Received event: ${event.type} (id=${event.id || "n/a"})`);

  // 3. TEST event = ack sans rien faire
  if (event.type === "TEST") {
    return json({ ok: true, type: "TEST" }, 200);
  }

  // 4. Récupérer l'app_user_id (= Supabase user_id, set via Purchases.logIn dans le client)
  const appUserId = event.app_user_id || event.original_app_user_id;
  if (!appUserId) {
    console.warn("[RC Webhook] event has no app_user_id, ignoring");
    return json({ ok: true, ignored: "no app_user_id" }, 200);
  }

  // Validation basique UUID — si ce n'est pas un UUID, c'est un anonymous RC id
  // qu'on ne peut pas mapper à un user Supabase.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(appUserId)) {
    console.warn(`[RC Webhook] app_user_id "${appUserId}" not a UUID, skipping`);
    return json({ ok: true, ignored: "non-uuid app_user_id" }, 200);
  }

  // 5. Vérifier que l'entitlement concerne notre produit
  const entitlements = event.entitlement_ids || [];
  if (event.type !== "EXPIRATION" && event.type !== "CANCELLATION" && entitlements.length > 0 && !entitlements.includes(ENTITLEMENT_ID)) {
    console.log(`[RC Webhook] event on different entitlement ${entitlements.join(",")}, ignoring`);
    return json({ ok: true, ignored: "different entitlement" }, 200);
  }

  // 6. Mapper event + period_type → status
  const status = mapToStatus(event);
  if (!status) {
    console.log(`[RC Webhook] event ${event.type} → no status change, ignoring`);
    return json({ ok: true, ignored: "no status mapping" }, 200);
  }

  // 7. Construire l'update
  const eventTsMs = event.event_timestamp_ms || Date.now();
  const expirationISO = event.expiration_at_ms ? new Date(event.expiration_at_ms).toISOString() : null;
  const purchasedISO = event.purchased_at_ms ? new Date(event.purchased_at_ms).toISOString() : null;

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  // 8. Récupérer la row existante pour le check d'idempotence + out-of-order
  const { data: existing, error: selErr } = await supabase
    .from("subscriptions")
    .select("id, last_event_at_ms")
    .eq("user_id", appUserId)
    .maybeSingle();

  if (selErr) {
    console.error("[RC Webhook] select failed:", selErr);
    return json({ error: "DB select failed" }, 500);
  }

  // Out-of-order guard: ignorer si on a déjà appliqué un event plus récent
  if (existing?.last_event_at_ms && existing.last_event_at_ms >= eventTsMs) {
    console.log(`[RC Webhook] event ${eventTsMs} older than last ${existing.last_event_at_ms}, skipping`);
    return json({ ok: true, ignored: "out of order" }, 200);
  }

  // 9. Construire les champs à écrire (provider isolation: ne jamais toucher stripe_*)
  const fields: Record<string, any> = {
    user_id: appUserId,
    status,
    provider: "revenuecat",
    revenuecat_app_user_id: appUserId,
    last_event_at_ms: eventTsMs,
    updated_at: new Date().toISOString(),
  };
  if (expirationISO) fields.current_period_end = expirationISO;
  if (status === "trialing") {
    if (purchasedISO) fields.trial_start = purchasedISO;
    if (expirationISO) fields.trial_end = expirationISO;
  } else if (status === "active") {
    if (purchasedISO) fields.current_period_start = purchasedISO;
  }

  // 10. Upsert
  const { error: upErr } = await supabase
    .from("subscriptions")
    .upsert(fields, { onConflict: "user_id" });

  if (upErr) {
    console.error("[RC Webhook] upsert failed:", upErr);
    return json({ error: "DB upsert failed", details: upErr.message }, 500);
  }

  console.log(`[RC Webhook] ✓ ${event.type} → ${status} for user ${appUserId.slice(0, 8)}…`);
  return json({ ok: true, status, user_id: appUserId }, 200);
});

function mapToStatus(event: RCEvent): "active" | "trialing" | "past_due" | "inactive" | null {
  const period = event.period_type || "NORMAL";
  switch (event.type) {
    case "INITIAL_PURCHASE":
    case "RENEWAL":
    case "UNCANCELLATION":
    case "PRODUCT_CHANGE":
      return period === "TRIAL" || period === "INTRO" ? "trialing" : "active";
    case "BILLING_ISSUE":
      // grâce ~16j Apple, on garde l'accès
      return "past_due";
    case "EXPIRATION":
      return "inactive";
    case "CANCELLATION":
      // L'abonnement est annulé mais reste actif jusqu'à la prochaine date d'expiration.
      // Pas de changement de status (EXPIRATION viendra plus tard).
      return null;
    case "NON_RENEWING_PURCHASE":
      return "active";
    case "TRANSFER":
      // Restore sur un nouveau device — on ne touche rien, le client refera setUserId
      // qui déclenchera un INITIAL_PURCHASE/RENEWAL pour le nouveau user.
      return null;
    case "SUBSCRIBER_ALIAS":
      // No-op: on ne fait pas d'anonymous→identified merge (toujours setUserId avec Supabase id).
      return null;
    default:
      return null;
  }
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
