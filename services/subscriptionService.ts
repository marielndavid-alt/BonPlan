import { supabase } from '@/lib/supabase';

export const createCheckoutSession = async (priceId: string): Promise<{ url: string | null, error: string | null }> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { url: null, error: 'Non connecté' };

    const { data, error } = await supabase.functions.invoke('create-checkout-session', {
      body: { priceId, userId: user.id, email: user.email },
    });

    if (error) return { url: null, error: error.message };
    return { url: data?.url || null, error: null };
  } catch (err: any) {
    return { url: null, error: err.message };
  }
};

export const createCustomerPortalSession = async (): Promise<{ url: string | null, error: string | null }> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { url: null, error: 'Non connecté' };

    const { data, error } = await supabase.functions.invoke('create-portal-session', {
      body: { userId: user.id },
    });

    if (error) return { url: null, error: error.message };
    return { url: data?.url || null, error: null };
  } catch (err: any) {
    return { url: null, error: err.message };
  }
};

export const subscriptionService = {
  createCheckoutSession,
  createCustomerPortalSession,
  async getSubscriptionStatus(userId: string) {
    const { data } = await supabase.from('subscriptions').select('*').eq('user_id', userId).maybeSingle();
    return data;
  },
};
