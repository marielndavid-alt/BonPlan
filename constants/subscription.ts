// IMPORTANT: must exactly match the Entitlement identifier in the RevenueCat dashboard
// (case-sensitive, with the space). Mismatch = silent failure (paid users see paywall).
// Same string is used server-side in supabase/functions/revenuecat-webhook/index.ts.
export const REVENUECAT_ENTITLEMENT_ID = 'Bon Plan Pro';

export const SUBSCRIPTION_TIERS = {
  monthly: {
    name: 'Mensuel',
    price: 5,
    price_id: 'price_1Sn7jN9JihDxt63sYz1Eq8ds', // Replace with your Stripe price ID
    interval: 'month',
    trial_days: 7,
  },
  yearly: {
    name: 'Annuel',
    price: 50,
    price_id: 'price_1SpFWv9JihDxt63sV3UdulHF', // Replace with your Stripe price ID
    interval: 'year',
    trial_days: 7,
  },
};
