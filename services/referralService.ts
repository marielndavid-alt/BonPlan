import { supabase } from '@/lib/supabase';
import { Share } from 'react-native';

export const referralService = {

  // Générer un code unique pour le user
  generateCode(userId: string): string {
    const base = userId.replace(/-/g, '').substring(0, 8).toUpperCase();
    const suffix = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `${base}${suffix}`;
  },

  // Obtenir ou créer le code de parrainage du user
  async getOrCreateCode(userId: string): Promise<string | null> {
    try {
      // Chercher un code existant
      const { data: existing } = await supabase
        .from('referrals')
        .select('code')
        .eq('referrer_id', userId)
        .is('referred_id', null)
        .limit(1)
        .single();

      if (existing?.code) return existing.code;

      // Créer un nouveau code
      const code = this.generateCode(userId);
      const { error } = await supabase
        .from('referrals')
        .insert({ referrer_id: userId, code });

      if (error) throw error;
      return code;
    } catch {
      return null;
    }
  },

  // Partager le lien de parrainage
  async shareReferralLink(userId: string): Promise<void> {
    const code = await this.getOrCreateCode(userId);
    if (!code) return;

    const link = `https://bonplan.co/rejoindre?ref=${code}`;
    await Share.share({
      message: `Rejoins-moi sur BonPlan et économise sur tes courses! Utilise mon code pour obtenir 1 mois gratuit : ${link}`,
      url: link,
    });
  },

  // Valider un code de parrainage lors de l'inscription
  async applyReferralCode(code: string, newUserId: string): Promise<boolean> {
    try {
      const { data: referral } = await supabase
        .from('referrals')
        .select('id, referrer_id, status')
        .eq('code', code)
        .eq('status', 'pending')
        .is('referred_id', null)
        .single();

      if (!referral) return false;
      if (referral.referrer_id === newUserId) return false; // Pas d'auto-parrainage

      const { error } = await supabase
  .from('referrals')
  .update({
    referred_id: newUserId,
    status: 'completed',
    completed_at: new Date().toISOString(),
  })
  .eq('id', referral.id);

if (!error) {
  await supabase.functions.invoke('apply-referral-credit', {
    body: { referrerId: referral.referrer_id, referredId: newUserId }
  });
}

return !error;
    } catch {
      return false;
    }
  },

  // Obtenir les statistiques de parrainage
  async getStats(userId: string): Promise<{ total: number; completed: number }> {
    try {
      const { data } = await supabase
        .from('referrals')
        .select('status')
        .eq('referrer_id', userId);

      const total = data?.length || 0;
      const completed = data?.filter(r => r.status === 'completed').length || 0;
      return { total, completed };
    } catch {
      return { total: 0, completed: 0 };
    }
  },
};
