import { supabase } from '@/lib/supabase';

export interface StorePromotionCount {
  storeCode: string;
  storeName: string;
  promotionCount: number;
}

export async function getPromotionsStatus() {
  try {
    const { count } = await supabase
      .from('promotions')
      .select('*', { count: 'exact', head: true });

    const { data: latest } = await supabase
      .from('promotions')
      .select('scraped_at, valid_to')
      .order('scraped_at', { ascending: false })
      .limit(1)
      .single();

    return {
      activePromotions: count || 0,
      lastScrapeDate: latest?.scraped_at,
      nextExpireDate: latest?.valid_to,
    };
  } catch {
    return { activePromotions: 0 };
  }
}

export async function getPromotionsByStore(): Promise<StorePromotionCount[]> {
  try {
    const { data } = await supabase
      .from('promotions')
      .select('store_code, store_name');

    if (!data) return [];

    const counts: Record<string, { name: string; count: number }> = {};
    data.forEach((row: any) => {
      const key = row.store_code;
      if (!counts[key]) {
        counts[key] = { name: row.store_name || key, count: 0 };
      }
      counts[key].count++;
    });

    return Object.entries(counts).map(([code, info]) => ({
      storeCode: code,
      storeName: info.name,
      promotionCount: info.count,
    }));
  } catch {
    return [];
  }
}
