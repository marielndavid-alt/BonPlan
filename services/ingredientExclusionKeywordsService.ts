import { supabase } from '@/lib/supabase';
export const addExclusionKeyword = async (productId: string, keyword: string) => {
  await supabase.from('ingredient_exclusion_keywords').insert({ product_id: productId, keyword });
};
export const removeExclusionKeyword = async (id: string) => {
  await supabase.from('ingredient_exclusion_keywords').delete().eq('id', id);
};
export const getExclusionKeywords = async (productId: string) => {
  const { data } = await supabase.from('ingredient_exclusion_keywords').select('*').eq('product_id', productId);
  return data || [];
};
