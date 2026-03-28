import { supabase } from '@/lib/supabase';
export const getBestPrices = async (productId: string) => {
  const { data } = await supabase.from('ingredient_best_prices').select('*').eq('product_id', productId);
  return data || [];
};
