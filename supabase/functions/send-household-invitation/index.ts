const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { inviterName, inviterEmail, inviteeEmail } = await req.json();
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'BonPlan <noreply@updates.bonplan.co>',
        to: inviteeEmail,
        subject: `${inviterName} vous invite à rejoindre son foyer sur BonPlan`,
        html: `<div style="font-family: Arial, sans-serif;"><h2 style="color: #f44a33;">Invitation BonPlan</h2><p><strong>${inviterName}</strong> (${inviterEmail}) vous invite à rejoindre son foyer sur BonPlan.</p><p>Téléchargez l'application et connectez-vous avec cette adresse email pour accepter l'invitation.</p></div>`,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      console.error('Resend error:', JSON.stringify(data));
      throw new Error(JSON.stringify(data));
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
