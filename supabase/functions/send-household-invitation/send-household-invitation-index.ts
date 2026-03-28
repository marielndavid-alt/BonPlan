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
    
    if (!RESEND_API_KEY) {
      // Pas de clé Resend — on simule le succès
      return new Response(JSON.stringify({ success: true, simulated: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'BonPlan <noreply@bonplan.co>',
        to: inviteeEmail,
        subject: `${inviterName} vous invite à rejoindre son foyer sur BonPlan`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #f44a33;">Invitation BonPlan</h2>
            <p>Bonjour,</p>
            <p><strong>${inviterName}</strong> (${inviterEmail}) vous invite à rejoindre son foyer sur BonPlan pour partager vos listes d'épicerie.</p>
            <p>Téléchargez l'application BonPlan et connectez-vous avec cette adresse email pour accepter l'invitation.</p>
            <p style="color: #666; font-size: 12px;">Si vous ne souhaitez pas rejoindre ce foyer, ignorez simplement cet email.</p>
          </div>
        `,
      }),
    });

    if (!res.ok) throw new Error('Erreur envoi email');

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
