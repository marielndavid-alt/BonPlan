// Stripe webhook handler.
// Reçoit les événements Stripe (checkout.session.completed, subscription.updated, etc.)
// et synchronise public.subscriptions pour que le RLS paywall (is_current_user_premium)
// reflète l'état réel de l'abonnement.
//
// Auth: signature Stripe vérifiée via STRIPE_WEBHOOK_SECRET (configuré dans Stripe
// Dashboard → Webhooks → Signing secret).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14?target=deno";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") || Deno.env.get("STRIPE") || "";
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "";

const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" });

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const sig = req.headers.get("stripe-signature");
  if (!sig || !STRIPE_WEBHOOK_SECRET) {
    return json({ error: "Missing signature or secret" }, 400);
  }

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, STRIPE_WEBHOOK_SECRET);
  } catch (e: any) {
    console.error("[Stripe Webhook] signature check failed:", e.message);
    return json({ error: "Invalid signature" }, 401);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  console.log(`[Stripe Webhook] Received event: ${event.type} (id=${event.id})`);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription") {
          return json({ ok: true, ignored: "not subscription" }, 200);
        }
        const userId = await resolveUserId(supabase, session.customer as string, session.metadata);
        if (!userId) return json({ ok: true, ignored: "no user_id" }, 200);

        const sub = await stripe.subscriptions.retrieve(session.subscription as string);
        await applySubscription(supabase, userId, sub, event.created);
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.resumed": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = await resolveUserId(supabase, sub.customer as string, sub.metadata);
        if (!userId) return json({ ok: true, ignored: "no user_id" }, 200);
        await applySubscription(supabase, userId, sub, event.created);
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = await resolveUserId(supabase, sub.customer as string, sub.metadata);
        if (!userId) return json({ ok: true, ignored: "no user_id" }, 200);
        await applyStatus(supabase, userId, "inactive", event.created, {
          stripe_subscription_id: sub.id,
        });
        break;
      }

      case "invoice.payment_failed": {
        const inv = event.data.object as Stripe.Invoice;
        const customerId = inv.customer as string;
        const userId = await resolveUserId(supabase, customerId, null);
        if (!userId) return json({ ok: true, ignored: "no user_id" }, 200);
        await applyStatus(supabase, userId, "past_due", event.created, {});
        break;
      }

      case "invoice.payment_succeeded": {
        const inv = event.data.object as Stripe.Invoice;
        const subId = (inv as any).subscription as string | null;
        if (!subId) return json({ ok: true, ignored: "no subscription on invoice" }, 200);
        const sub = await stripe.subscriptions.retrieve(subId);
        const userId = await resolveUserId(supabase, sub.customer as string, sub.metadata);
        if (!userId) return json({ ok: true, ignored: "no user_id" }, 200);
        await applySubscription(supabase, userId, sub, event.created);
        break;
      }

      default:
        console.log(`[Stripe Webhook] event ${event.type} ignored`);
    }

    return json({ ok: true }, 200);
  } catch (e: any) {
    console.error("[Stripe Webhook] handler error:", e);
    return json({ error: e.message }, 500);
  }
});

// Map Stripe subscription status → notre enum local
function mapStatus(stripeStatus: string): "active" | "trialing" | "past_due" | "inactive" | null {
  switch (stripeStatus) {
    case "active": return "active";
    case "trialing": return "trialing";
    case "past_due":
    case "unpaid": return "past_due";
    case "canceled":
    case "incomplete":
    case "incomplete_expired":
    case "paused": return "inactive";
    default: return null;
  }
}

async function resolveUserId(
  supabase: any,
  stripeCustomerId: string | null,
  metadata: Record<string, string> | null,
): Promise<string | null> {
  // Source #1: metadata (set par create-checkout-session OU stripe-checkout)
  const metaUserId = metadata?.supabase_user_id || metadata?.userId || null;
  if (metaUserId) return metaUserId;

  // Source #2: existing subscription row (stripe-checkout l'écrit avant le checkout)
  if (stripeCustomerId) {
    const { data } = await supabase
      .from("subscriptions")
      .select("user_id")
      .eq("stripe_customer_id", stripeCustomerId)
      .maybeSingle();
    if (data?.user_id) return data.user_id;

    // Source #3: customer metadata sur Stripe (fallback final)
    try {
      const cust = await stripe.customers.retrieve(stripeCustomerId);
      if (!cust.deleted) {
        const cMeta = (cust as Stripe.Customer).metadata;
        return cMeta?.supabase_user_id || cMeta?.userId || null;
      }
    } catch {/* ignore */}
  }
  return null;
}

async function applySubscription(
  supabase: any,
  userId: string,
  sub: Stripe.Subscription,
  eventCreatedSec: number,
) {
  const status = mapStatus(sub.status);
  if (!status) {
    console.log(`[Stripe Webhook] no status mapping for stripe status ${sub.status}`);
    return;
  }
  const eventTsMs = eventCreatedSec * 1000;
  const periodEndIso = (sub as any).current_period_end
    ? new Date((sub as any).current_period_end * 1000).toISOString()
    : null;
  const periodStartIso = (sub as any).current_period_start
    ? new Date((sub as any).current_period_start * 1000).toISOString()
    : null;
  const trialEndIso = sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null;
  const trialStartIso = sub.trial_start ? new Date(sub.trial_start * 1000).toISOString() : null;

  await applyStatus(supabase, userId, status, eventCreatedSec, {
    stripe_subscription_id: sub.id,
    stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
    current_period_end: periodEndIso,
    current_period_start: periodStartIso,
    trial_end: trialEndIso,
    trial_start: trialStartIso,
  }, eventTsMs);
}

async function applyStatus(
  supabase: any,
  userId: string,
  status: "active" | "trialing" | "past_due" | "inactive",
  eventCreatedSec: number,
  extra: Record<string, any>,
  eventTsMsParam?: number,
) {
  const eventTsMs = eventTsMsParam || eventCreatedSec * 1000;

  const { data: existing } = await supabase
    .from("subscriptions")
    .select("last_event_at_ms")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing?.last_event_at_ms && existing.last_event_at_ms >= eventTsMs) {
    console.log(`[Stripe Webhook] event ${eventTsMs} older than ${existing.last_event_at_ms}, skipping`);
    return;
  }

  const fields: Record<string, any> = {
    user_id: userId,
    status,
    provider: "stripe",
    last_event_at_ms: eventTsMs,
    updated_at: new Date().toISOString(),
    ...extra,
  };

  // Nettoyer les valeurs undefined/null pour ne pas écraser
  Object.keys(fields).forEach((k) => {
    if (fields[k] === undefined) delete fields[k];
  });

  const { error } = await supabase.from("subscriptions").upsert(fields, { onConflict: "user_id" });
  if (error) {
    console.error("[Stripe Webhook] upsert failed:", error);
    throw error;
  }
  console.log(`[Stripe Webhook] ✓ ${status} for user ${userId.slice(0, 8)}…`);
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
