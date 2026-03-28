import { supabase } from '@/lib/supabase';
import { Recipe } from '@/types';

async function adjustPricesForPantry(recipes: Recipe[]): Promise<Recipe[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return recipes;

    const recipeIds = recipes.map(r => r.id);

    // Une seule requête pour tout chercher en parallèle
    const [
      { data: pantry },
      { data: storePrices },
      { data: ingPrices },
      { data: recipeIngs },
    ] = await Promise.all([
      supabase.from('pantry_items').select('name').eq('user_id', user.id),
      supabase.from('recipe_store_prices')
        .select('recipe_id, store_id, total_price, ingredients_covered, ingredients_total, stores(code)')
        .in('recipe_id', recipeIds)
        .order('total_price', { ascending: true }),
      supabase.from('recipe_ingredient_prices')
        .select('recipe_id, recipe_ingredient_id, store_id, cost')
        .in('recipe_id', recipeIds),
      supabase.from('recipe_ingredients')
        .select('id, recipe_id, products(name)')
        .in('recipe_id', recipeIds),
    ]);

    const pantryNames = (pantry || []).map((p: any) => p.name.toLowerCase());

    return recipes.map(recipe => {
      const recipeIngList = (recipeIngs || []).filter((ri: any) => ri.recipe_id === recipe.id);
      const pantryIngIds = new Set(
        recipeIngList
          .filter((ri: any) => {
            const name = ri.products?.name?.toLowerCase() || '';
            return pantryNames.some((pn: string) => name.includes(pn) || pn.includes(name));
          })
          .map((ri: any) => ri.id)
      );

      const recipeStorePrices = (storePrices || []).filter((sp: any) => sp.recipe_id === recipe.id);
      const recipeIngPrices = (ingPrices || []).filter((ip: any) => ip.recipe_id === recipe.id);

      let best: { total: number; storeCode: string } | null = null;

      for (const sp of recipeStorePrices) {
        const storeIngPrices = recipeIngPrices.filter((ip: any) => ip.store_id === sp.store_id);
        const pantrySavings = storeIngPrices
          .filter((ip: any) => pantryIngIds.has(ip.recipe_ingredient_id))
          .reduce((sum: number, ip: any) => sum + (ip.cost || 0), 0);
        const missingCoveredByPantry = recipeIngList.filter((ri: any) => {
          const name = ri.products?.name?.toLowerCase() || '';
          const isInPantry = pantryNames.some((pn: string) => name.includes(pn) || pn.includes(name));
          const hasPrice = storeIngPrices.some((ip: any) => ip.recipe_ingredient_id === ri.id);
          return isInPantry && !hasPrice;
        }).length;
        const effectiveCovered = sp.ingredients_covered + missingCoveredByPantry;
        if (effectiveCovered >= sp.ingredients_total) {
          const adjustedTotal = Math.max(0, sp.total_price - pantrySavings);
          if (!best || adjustedTotal < best.total) {
            best = { total: adjustedTotal, storeCode: (sp.stores as any).code };
          }
        }
      }

      if (best) {
        return { ...recipe, totalPrice: best.total, bestStore: best.storeCode };
      }
      return { ...recipe, totalPrice: 0, bestStore: 'N/A' };
    });
  } catch (e) {
    console.error('[adjustPricesForPantry]', e);
    return recipes;
  }
}

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

      const mapped = (data || []).map(mapDbRecipe);
      return await adjustPricesForPantry(mapped);
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
