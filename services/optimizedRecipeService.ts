import { supabase } from '@/lib/supabase';
import { Recipe } from '@/types';

interface RecipeFilters {
  category?: 'main' | 'snack';
  userStores?: string[];
  limitByStore?: boolean;
  dietTags?: string[];
  limit?: number;
}

function mapDbRecipe(row: any): Recipe {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    image: row.image,
    category: row.category || 'main',
    prepTime: row.prep_time || 30,
    servings: row.servings || 4,
    difficulty: row.difficulty,
    tags: row.tags || [],
    diet_tags: row.diet_tags || [],
    instructions: row.instructions,
    totalPrice: parseFloat(row.total_price) || 0,
    bestStore: row.best_store || 'N/A',
  };
}

export const optimizedRecipeService = {
  async getRecipes(filters: RecipeFilters = {}): Promise<Recipe[]> {
    try {
      let query = supabase
        .from('recipes_with_best_store')
        .select('*')
        .order('title');

      if (filters.category) {
        query = query.eq('category', filters.category);
      }

      if (filters.userStores && filters.userStores.length > 0) {
        query = query.in('best_store', filters.userStores);
      }

      if (filters.dietTags && filters.dietTags.length > 0) {
        // Filter by tags - overlap
        query = query.overlaps('tags', filters.dietTags);
      }

      const { data, error } = await query.limit(filters.limit || 8);

      if (error) {
        console.error('[RecipeService] Error:', error);
        return [];
      }

      return (data || []).map(mapDbRecipe);
    } catch (err) {
      console.error('[RecipeService] Exception:', err);
      return [];
    }
  },

  async getRecipeById(id: string): Promise<Recipe | null> {
    try {
      const { data, error } = await supabase
        .from('recipes_with_best_store')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) return null;
      return mapDbRecipe(data);
    } catch {
      return null;
    }
  },

  async getRecipeWithIngredients(id: string): Promise<Recipe | null> {
    try {
      const { data: recipeData, error: recipeError } = await supabase
        .from('recipes_with_best_store')
        .select('*')
        .eq('id', id)
        .single();

      if (recipeError || !recipeData) return null;

      const { data: ingredients } = await supabase
        .from('recipe_ingredients')
        .select(`
          id, quantity, unit, notes, optional,
          products (id, name, category, unit)
        `)
        .eq('recipe_id', id);

      const recipe = mapDbRecipe(recipeData);
      recipe.ingredients = (ingredients || []).map((ing: any) => ({
        id: ing.id,
        recipeId: id,
        productId: ing.products?.id,
        productName: ing.products?.name,
        quantity: ing.quantity,
        unit: ing.unit,
        notes: ing.notes,
        optional: ing.optional,
      }));

      return recipe;
    } catch {
      return null;
    }
  },

  async createRecipe(recipe: Partial<Recipe> & { title: string }): Promise<Recipe | null> {
    try {
      const { data, error } = await supabase
        .from('recipes')
        .insert({
          title: recipe.title,
          description: recipe.description,
          image: recipe.image,
          category: recipe.category || 'main',
          prep_time: recipe.prepTime,
          servings: recipe.servings || 4,
          difficulty: recipe.difficulty,
          tags: recipe.tags || [],
          instructions: recipe.instructions,
        })
        .select()
        .single();

      if (error) throw error;
      return mapDbRecipe({ ...data, total_price: 0, best_store: 'N/A' });
    } catch {
      return null;
    }
  },

  async updateRecipe(id: string, updates: Partial<Recipe>): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('recipes')
        .update({
          title: updates.title,
          description: updates.description,
          image: updates.image,
          category: updates.category,
          prep_time: updates.prepTime,
          servings: updates.servings,
          difficulty: updates.difficulty,
          tags: updates.tags,
          instructions: updates.instructions,
        })
        .eq('id', id);

      return !error;
    } catch {
      return false;
    }
  },

  async deleteRecipe(id: string): Promise<boolean> {
    try {
      const { error } = await supabase.from('recipes').delete().eq('id', id);
      return !error;
    } catch {
      return false;
    }
  },
};
