import { supabase } from '@/lib/supabase';
export const getConversions = async (productId: string) => {
  const { data } = await supabase.from('ingredient_conversions').select('*').eq('product_id', productId);
  return data || [];
};
export const addConversion = async (productId: string, conversion: any) => {
  await supabase.from('ingredient_conversions').insert({ product_id: productId, ...conversion });
};
export const removeConversion = async (id: string) => {
  await supabase.from('ingredient_conversions').delete().eq('id', id);
};
