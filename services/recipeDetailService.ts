import { supabase } from '@/lib/supabase';

export const recipeDetailService = {
  async getById(id: string) {
    const { data } = await supabase
      .from('recipes_with_best_store')
      .select('*')
      .eq('id', id)
      .single();
    return data || null;
  },
  async getIngredients(recipeId: string) {
    const { data } = await supabase
      .from('recipe_ingredients')
      .select('*, products(*, prices(*, stores(code, name, color)))')
      .eq('recipe_id', recipeId);
    return data || [];
  },
};
