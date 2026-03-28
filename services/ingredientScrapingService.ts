import { supabase } from '@/lib/supabase';

export const ingredientScrapingService = {
  async scrapeIngredient(name: string) {
    try {
      const { data, error } = await supabase.functions.invoke('scrape-ingredients-google', {
        body: { ingredient: name }
      });
      if (error) throw error;
      return data;
    } catch (err) {
      console.error('Scraping error:', err);
      return null;
    }
  },

  async getAllIngredients() {
    const { data } = await supabase.from('products').select('id, name, category').order('name');
    return data || [];
  },

  async scrapeAll(onProgress?: (current: number, total: number, name: string) => void) {
    const ingredients = await this.getAllIngredients();
    const results = [];
    for (let i = 0; i < ingredients.length; i++) {
      const ing = ingredients[i];
      onProgress?.(i + 1, ingredients.length, ing.name);
      const result = await this.scrapeIngredient(ing.name);
      results.push({ ingredient: ing.name, result });
    }
    return results;
  },
};

export interface IngredientScrapingProgress { current: number; total: number; name: string; status: string; }
export type ScrapingMethod = 'google' | 'firecrawl' | 'auto';

export const scrapeIngredientAsync = async (
  productId: string,
  method: ScrapingMethod = 'auto',
  onProgress?: (progress: IngredientScrapingProgress) => void
) => {
  try {
    const { data, error } = await supabase.functions.invoke('scrape-ingredients-' + method, {
      body: { product_id: productId }
    });
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Async scraping error:', err);
    return null;
  }
};
