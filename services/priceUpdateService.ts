import { supabase } from '@/lib/supabase';
export const updatePrice = async (priceId: string, updates: any) => {
  const { data } = await supabase.from('prices').update(updates).eq('id', priceId).select().single();
  return data;
};
