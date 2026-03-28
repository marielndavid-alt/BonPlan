import Stripe from 'https://esm.sh/stripe@14?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE') ?? '', {
  apiVersion: '2023-10-16',
});

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function addFreeMonth(userId: string) {
  // Chercher le customer Stripe lié à ce userId
  const customers = await stripe.customers.search({
    query: `metadata['userId']:'${userId}'`,
  });

  if (customers.data.length === 0) return false;

  const customerId = customers.data[0].id;

  // Ajouter un crédit de 1 mois (valeur du plan mensuel = ~500 cents = 5$)
  await stripe.customers.createBalanceTransaction(customerId, {
    amount: -500, // -500 cents = -5$ de crédit
    currency: 'cad',
    description: 'Crédit de parrainage - 1 mois gratuit',
  });

  return true;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { referrerId, referredId } = await req.json();

    if (!referrerId || !referredId) {
      return new Response(JSON.stringify({ error: 'referrerId et referredId requis' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Vérifier que le referral existe et est complété
    const { data: referral } = await supabase
      .from('referrals')
      .select('id, status')
      .eq('referrer_id', referrerId)
      .eq('referred_id', referredId)
      .eq('status', 'completed')
      .single();

    if (!referral) {
      return new Response(JSON.stringify({ error: 'Parrainage non trouvé' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Ajouter 1 mois gratuit aux deux utilisateurs
    const [referrerCredit, referredCredit] = await Promise.all([
      addFreeMonth(referrerId),
      addFreeMonth(referredId),
    ]);

    return new Response(JSON.stringify({
      success: true,
      referrerCredit,
      referredCredit,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
