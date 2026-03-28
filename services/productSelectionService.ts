import { supabase } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ProductWithPrice {
  id: string;
  name: string;
  category?: string;
  unit: string;
  bestPrice?: number;
  bestStore?: string;
  imageUrl?: string;
}

const RECENT_PRODUCTS_KEY = 'recent_products';
const MAX_RECENT = 20;

let initialized = false;
let cachedProducts: ProductWithPrice[] = [];

export const productSelectionService = {
  initialize() {
    initialized = true;
  },

async preloadProducts(): Promise<void> {
  try {
    const { data } = await supabase
      .from('recipe_ingredients')
      .select(`
        product_id,
        products (
          id, name, category, unit,
          prices (
            regular_price,
            sale_price,
            store_id
          )
        )
      `)
      .limit(500);

    const { data: stores } = await supabase
      .from('stores')
      .select('id, code, name');

    const storeMap = new Map((stores || []).map((s: any) => [s.id, s.code]));

    cachedProducts = (data || [])
      .map((ri: any) => ri.products)
      .filter(Boolean)
      .filter((p: any, index: number, self: any[]) =>
        self.findIndex((pp: any) => pp.id === p.id) === index
      )
      .map((p: any) => {
        const prices = p.prices || [];
        const sorted = [...prices].sort((a: any, b: any) =>
          (a.sale_price || a.regular_price) - (b.sale_price || b.regular_price)
        );
        return {
          id: p.id,
          name: p.name,
          category: p.category,
          unit: p.unit,
          bestPrice: sorted[0] ? (sorted[0].sale_price || sorted[0].regular_price) : undefined,
          bestStore: sorted[0] ? storeMap.get(sorted[0].store_id) : undefined,
        };
      });
  } catch (err) {
    console.error('[ProductSelection] Preload error:', err);
  }
},

  async getSuggestedProducts(): Promise<ProductWithPrice[]> {
    if (cachedProducts.length === 0) {
      await this.preloadProducts();
    }
    return cachedProducts.slice(0, 100);
  },

  async getRecentProducts(): Promise<ProductWithPrice[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data } = await supabase
        .from('shopping_list_items')
        .select('name, unit, price, store')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      const seen = new Set<string>();
      return (data || [])
        .filter((item: any) => {
          if (seen.has(item.name)) return false;
          seen.add(item.name);
          return true;
        })
        .map((item: any) => ({
          id: item.name,
          name: item.name,
          unit: item.unit,
          bestPrice: item.price,
          bestStore: item.store,
        }));
    } catch {
      return [];
    }
  },

  async markAsRecentlyUsed(product: ProductWithPrice): Promise<void> {
    try {
      const recent = await AsyncStorage.getItem(RECENT_PRODUCTS_KEY);
      const list = recent ? JSON.parse(recent) : [];
      const filtered = list.filter((p: any) => p.id !== product.id);
      const updated = [product, ...filtered].slice(0, MAX_RECENT);
      await AsyncStorage.setItem(RECENT_PRODUCTS_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }
  },

  async searchProducts(query: string): Promise<ProductWithPrice[]> {
   
  try {
    const normalized = query.toLowerCase().trim();

    if (cachedProducts.length > 0) {
  const cacheResults = cachedProducts.filter(p =>
    p.name.toLowerCase().includes(normalized)
  ).slice(0, 20);
  if (cacheResults.length > 0 && cacheResults[0].bestStore) return cacheResults;
}

    const { data: stores } = await supabase
      .from('stores')
      .select('id, code');

    const storeMap = new Map((stores || []).map((s: any) => [s.id, s.code]));

    const { data } = await supabase
      .from('products')
      .select(`
        id, name, category, unit,
        prices (regular_price, sale_price, store_id)
      `)
      .ilike('name', `%${query.replace(/œ/g, 'oe').replace(/æ/g, 'ae')}%`)

      .limit(20);

    return (data || []).map((p: any) => {
      const prices = p.prices || [];
      const sorted = [...prices].sort((a: any, b: any) =>
        (a.sale_price || a.regular_price) - (b.sale_price || b.regular_price)
      );
      return {
        id: p.id,
        name: p.name,
        category: p.category,
        unit: p.unit,
        bestPrice: sorted[0] ? (sorted[0].sale_price || sorted[0].regular_price) : undefined,
        bestStore: sorted[0] ? storeMap.get(sorted[0].store_id) : undefined,
      };
    });
  } catch {
    return [];
  }
},
};
