import { supabase } from '@/lib/supabase';

export const dealDetailService = {
  async getDealById(id: string) {
    try {
      const { data, error } = await supabase
        .from('promotions')
        .select('*')
        .eq('id', id)
        .single();
      if (error) return null;
      return data;
    } catch {
      return null;
    }
  },
};
