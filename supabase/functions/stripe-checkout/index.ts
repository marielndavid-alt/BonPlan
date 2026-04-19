import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')!
const STRIPE_PRICE_MONTHLY = 'price_1Sn7jN9JihDxt63sYz1Eq8ds'
const STRIPE_PRICE_YEARLY = 'price_1SpFWv9JihDxt63sV3UdulHF'
const APP_URL = 'https://graceful-piroshki-b7f549.netlify.app'
const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response('Unauthorized', { status: 401, headers: corsHeaders })
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return new Response('Unauthorized', { status: 401, headers: corsHeaders })
    const { plan } = await req.json()
    const priceId = plan === 'yearly' ? STRIPE_PRICE_YEARLY : STRIPE_PRICE_MONTHLY
    let stripeCustomerId = null
    const { data: sub } = await supabase.from('subscriptions').select('stripe_customer_id').eq('user_id', user.id).single()
    stripeCustomerId = sub?.stripe_customer_id || null
    if (!stripeCustomerId) {
      const customerRes = await fetch('https://api.stripe.com/v1/customers', { method: 'POST', headers: { 'Authorization': `Bearer ${STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ email: user.email || '', 'metadata[supabase_user_id]': user.id }) })
      const customer = await customerRes.json()
      stripeCustomerId = customer.id
      await supabase.from('subscriptions').upsert({ user_id: user.id, stripe_customer_id: stripeCustomerId, status: 'inactive' }, { onConflict: 'user_id' })
    }
    const params = new URLSearchParams({ 'customer': stripeCustomerId, 'mode': 'subscription', 'line_items[0][price]': priceId, 'line_items[0][quantity]': '1', 'subscription_data[trial_period_days]': '7', 'success_url': `${APP_URL}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`, 'cancel_url': `${APP_URL}/?checkout=cancel`, 'metadata[supabase_user_id]': user.id, 'allow_promotion_codes': 'true' })
    const sessionRes = await fetch('https://api.stripe.com/v1/checkout/sessions', { method: 'POST', headers: { 'Authorization': `Bearer ${STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: params })
    const session = await sessionRes.json()
    if (session.error) throw new Error(session.error.message)
    return new Response(JSON.stringify({ url: session.url }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
