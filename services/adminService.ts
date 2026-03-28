import { supabase } from '@/lib/supabase';

export const adminService = {
  async getStats() {
    const [recipes, products, users, promotions] = await Promise.all([
      supabase.from('recipes').select('id', { count: 'exact', head: true }),
      supabase.from('products').select('id', { count: 'exact', head: true }),
      supabase.from('user_profiles').select('id', { count: 'exact', head: true }),
      supabase.from('promotions').select('id', { count: 'exact', head: true }),
    ]);
    return {
      recipes: recipes.count || 0,
      products: products.count || 0,
      users: users.count || 0,
      promotions: promotions.count || 0,
    };
  },
};
