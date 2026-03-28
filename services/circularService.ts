import { supabase } from '@/lib/supabase';
import { Deal } from '@/types';

export type { Deal };

export const circularService = {
  async getWeeklyDeals(): Promise<Deal[]> {
    try {
      const { data, error } = await supabase
        .from('prices')
        .select(`
          id,
          regular_price,
          sale_price,
          unit_type,
          last_updated,
          products (
            id,
            name,
            category,
            image_url
          ),
          stores (
            id,
            name,
            code
          )
        `)
        .eq('is_on_sale', true)
        .limit(500);

      if (error) {
        console.error('[CircularService]', error);
        return [];
      }

      return (data || []).map((row: any) => ({
        id: row.id,
        store_code: row.stores?.code,
        store_name: row.stores?.name,
        product_name: row.products?.name,
        original_price: row.regular_price,
        sale_price: row.sale_price,
        discount_percentage: row.regular_price && row.sale_price
          ? Math.round((1 - row.sale_price / row.regular_price) * 100)
          : undefined,
        unit: row.unit_type,
        image_url: row.products?.image_url,
        product_category: row.products?.category,
        scraped_at: row.last_updated,
      }));
    } catch (err) {
      console.error('[CircularService] Exception:', err);
      return [];
    }
  },

  async getDealById(id: string): Promise<Deal | null> {
    try {
      const { data, error } = await supabase
        .from('prices')
        .select(`
          id,
          regular_price,
          sale_price,
          unit_type,
          products (id, name, category, image_url),
          stores (id, name, code)
        `)
        .eq('id', id)
        .single();

      if (error || !data) return null;

      return {
        id: data.id,
        store_code: (data.stores as any)?.code,
        store_name: (data.stores as any)?.name,
        product_name: (data.products as any)?.name,
        original_price: data.regular_price,
        sale_price: data.sale_price,
        unit: data.unit_type,
        image_url: (data.products as any)?.image_url,
        product_category: (data.products as any)?.category,
      };
    } catch {
      return null;
    }
  },
};