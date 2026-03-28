import { supabase } from '@/lib/supabase';
export const deleteIngredientMapping = async (id: string) => {
  await supabase.from('ingredient_product_links').delete().eq('id', id);
};
