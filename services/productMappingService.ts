import { supabase } from '@/lib/supabase';
export const getMappings = async (productId: string) => {
  const { data } = await supabase.from('ingredient_product_links').select('*').eq('product_id', productId);
  return data || [];
};
export const addMapping = async (productId: string, mapping: any) => {
  await supabase.from('ingredient_product_links').insert({ product_id: productId, ...mapping });
};
