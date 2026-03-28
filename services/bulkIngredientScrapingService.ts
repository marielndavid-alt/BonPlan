import { supabase } from '@/lib/supabase';

export interface BulkScrapingProgress {
  totalIngredients: number;
  completedIngredients: number;
  currentIngredient: string;
  totalPricesAdded: number;
  failedIngredients: string[];
  phaseProgress?: string;
  currentIngredientProgress?: { totalProducts: number };
}

export interface BulkScrapingResult {
  success: boolean;
  totalIngredients: number;
  successfulIngredients: number;
  totalPricesAdded: number;
  failedIngredients: string[];
  error?: string;
}

type ScrapingMethod = 'google-shopping' | 'firecrawl';

export async function scrapeAllIngredients(
  onProgress: (progress: BulkScrapingProgress) => void,
  method: ScrapingMethod = 'google-shopping',
  concurrency: number = 1
): Promise<BulkScrapingResult> {
  return scrapeAllIngredientsWithGoogle(onProgress, concurrency);
}

export async function scrapeAllIngredientsWithGoogle(
  onProgress: (progress: BulkScrapingProgress) => void,
  concurrency: number = 1
): Promise<BulkScrapingResult> {
  try {
    const { data, error } = await supabase.functions.invoke('scrape-ingredients-google', {
      body: { concurrency },
    });

    if (error) {
      return { success: false, totalIngredients: 0, successfulIngredients: 0, totalPricesAdded: 0, failedIngredients: [], error: error.message };
    }

    return {
      success: true,
      totalIngredients: data?.total || 0,
      successfulIngredients: data?.successful || 0,
      totalPricesAdded: data?.pricesAdded || 0,
      failedIngredients: data?.failed || [],
    };
  } catch (err: any) {
    return { success: false, totalIngredients: 0, successfulIngredients: 0, totalPricesAdded: 0, failedIngredients: [], error: err.message };
  }
}

export async function scrapeAllIngredientsWithFirecrawl(
  onProgress: (progress: BulkScrapingProgress) => void,
  stores: string[] = ['metro', 'maxi']
): Promise<BulkScrapingResult> {
  try {
    const { data, error } = await supabase.functions.invoke('scrape-ingredients-firecrawl', {
      body: { stores },
    });

    if (error) {
      return { success: false, totalIngredients: 0, successfulIngredients: 0, totalPricesAdded: 0, failedIngredients: [], error: error.message };
    }

    return {
      success: true,
      totalIngredients: data?.total || 0,
      successfulIngredients: data?.successful || 0,
      totalPricesAdded: data?.pricesAdded || 0,
      failedIngredients: data?.failed || [],
    };
  } catch (err: any) {
    return { success: false, totalIngredients: 0, successfulIngredients: 0, totalPricesAdded: 0, failedIngredients: [], error: err.message };
  }
}
