import { supabase } from '@/lib/supabase';
export const addInclusionKeyword = async (productId: string, keyword: string) => {
  await supabase.from('ingredient_inclusion_keywords').insert({ product_id: productId, keyword });
};
export const removeInclusionKeyword = async (id: string) => {
  await supabase.from('ingredient_inclusion_keywords').delete().eq('id', id);
};
export const getInclusionKeywords = async (productId: string) => {
  const { data } = await supabase.from('ingredient_inclusion_keywords').select('*').eq('product_id', productId);
  return data || [];
};
