import { useState, useEffect } from 'react';
import { optimizedRecipeService } from '@/services/optimizedRecipeService';
import { Recipe } from '@/types';

interface UseOptimizedRecipesOptions {
  category?: 'main' | 'snack';
  userStores?: string[];
  limitByStore?: boolean;
  dietTags?: string[];
}

export function useOptimizedRecipes(options: UseOptimizedRecipesOptions = {}) {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const optionsKey = JSON.stringify(options);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await optimizedRecipeService.getRecipes(options);
        if (!cancelled) {
          setRecipes(data);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => { cancelled = true; };
  }, [optionsKey]);

  return { recipes, loading, error, refetch: () => {} };
}
