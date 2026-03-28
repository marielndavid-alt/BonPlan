import { supabase } from '@/lib/supabase';
import { WeeklyMenuItem, DayOfWeek } from '@/types';

export type { DayOfWeek };

export const weeklyMenuService = {
  async getMenuItems(userId: string): Promise<WeeklyMenuItem[]> {
    try {
      const { data, error } = await supabase
        .from('weekly_menus')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) return [];

      return (data || []).map((row: any) => ({
        id: row.id,
        userId: row.user_id,
        recipeId: row.recipe_id,
        title: row.title,
        day: row.day,
        servings: row.servings,
        totalPrice: row.total_price,
        createdAt: row.created_at,
      }));
    } catch {
      return [];
    }
  },

  async addMenuItem(userId: string, item: Omit<WeeklyMenuItem, 'id'>): Promise<WeeklyMenuItem | null> {
    try {
      const { data, error } = await supabase
        .from('weekly_menus')
        .insert({
          user_id: userId,
          recipe_id: item.recipeId,
          title: item.title,
          day: item.day,
          servings: item.servings || 4,
          total_price: item.totalPrice || 0,
        })
        .select()
        .single();

      if (error) return null;

      return {
        id: data.id,
        userId: data.user_id,
        recipeId: data.recipe_id,
        title: data.title,
        day: data.day,
        servings: data.servings,
        totalPrice: data.total_price,
      };
    } catch {
      return null;
    }
  },

  async removeMenuItem(itemId: string): Promise<boolean> {
    try {
      const { error } = await supabase.from('weekly_menus').delete().eq('id', itemId);
      return !error;
    } catch {
      return false;
    }
  },

  async removeMenuItemByRecipeId(userId: string, recipeId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('weekly_menus')
        .delete()
        .eq('user_id', userId)
        .eq('recipe_id', recipeId);
      return !error;
    } catch {
      return false;
    }
  },

  async clearMenu(userId: string): Promise<boolean> {
    try {
      const { error } = await supabase.from('weekly_menus').delete().eq('user_id', userId);
      return !error;
    } catch {
      return false;
    }
  },

  async updateMenuItemDay(itemId: string, day: DayOfWeek | null): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('weekly_menus')
        .update({ day })
        .eq('id', itemId);
      return !error;
    } catch {
      return false;
    }
  },

  calculateTotalCost(items: WeeklyMenuItem[]): number {
    return items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
  },
};
