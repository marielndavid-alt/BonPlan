import { supabase } from '@/lib/supabase';

export interface IngredientDetail {
  id: string;
  name: string;
  category: string;
  unit: string;
  image_url?: string;
  prices?: any[];
}

export const updateIngredientConversionFactor = async (id: string, factor: number) => {
  await supabase.from('products').update({ conversion_factor: factor }).eq('id', id);
};

export const ingredientDetailService = {
  async getById(id: string): Promise<IngredientDetail | null> {
    const { data } = await supabase
      .from('products')
      .select('*, prices(*, stores(code, name, color))')
      .eq('id', id)
      .single();
    return data || null;
  },
  async update(id: string, updates: Partial<IngredientDetail>) {
    const { data } = await supabase.from('products').update(updates).eq('id', id).select().single();
    return data;
  },
  async delete(id: string) {
    await supabase.from('products').delete().eq('id', id);
  },
};
