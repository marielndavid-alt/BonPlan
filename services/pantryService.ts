import { supabase } from '@/lib/supabase';

export const pantryService = {
  async getItems(userId: string) {
    const { data } = await supabase.from('pantry_items').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    return data || [];
  },
  async addItem(userId: string, item: any) {
    const { data } = await supabase.from('pantry_items').insert({ ...item, user_id: userId }).select().single();
    return data;
  },
  async updateItem(id: string, updates: any) {
    const { data } = await supabase.from('pantry_items').update(updates).eq('id', id).select().single();
    return data;
  },
  async deleteItem(id: string) {
    await supabase.from('pantry_items').delete().eq('id', id);
  },
  async getAllRecipeIngredients(): Promise<{ id: string; name: string; category?: string }[]> {
  try {
    const { data } = await supabase
      .from('recipe_ingredients')
      .select(`
        product_id,
        products (id, name, category)
      `)
      .limit(500);

    const seen = new Set<string>();
    return (data || [])
      .map((ri: any) => ri.products)
      .filter(Boolean)
      .filter((p: any) => {
        if (seen.has(p.id)) return false;
        seen.add(p.id);
        return true;
      })
      .map((p: any) => ({
        id: p.id,
        name: p.name,
        category: p.category,
      }))
      .sort((a: any, b: any) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
},
};
