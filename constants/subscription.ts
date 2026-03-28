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
