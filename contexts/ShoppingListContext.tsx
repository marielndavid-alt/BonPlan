import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/template';
import { ShoppingListItem, ShoppingListCategory } from '@/types';

interface ShoppingListContextType {
  items: ShoppingListItem[];
  totalPrice: number;
  uncheckedCount: number;
  loading: boolean;
  bestStoreForList: { storeCode: string; total: number } | null;
  toggleCheck: (id: string) => void;
  removeItem: (id: string) => void;
  addItem: (item: Omit<ShoppingListItem, 'userId' | 'createdAt'>, stores?: string[]) => Promise<void>;
  updateItem: (id: string, updates: Partial<ShoppingListItem>) => void;
  clearChecked: () => void;
  clearAll: () => void;
  refreshPrices: (stores: string[]) => Promise<void>;
}

const ShoppingListContext = createContext<ShoppingListContextType>({
  items: [],
  totalPrice: 0,
  uncheckedCount: 0,
  loading: false,
  bestStoreForList: null,
  toggleCheck: () => {},
  removeItem: () => {},
  addItem: async () => {},
  updateItem: () => {},
  clearChecked: () => {},
  clearAll: () => {},
  refreshPrices: async () => {},
});

export function ShoppingListProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [items, setItems] = useState<ShoppingListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [bestStoreForList, setBestStoreForList] = useState<{ storeCode: string; total: number } | null>(null);

  const load = useCallback(async () => {
    if (!user) { setItems([]); return; }
    setLoading(true);
    try {
      const { data } = await supabase
        .from('shopping_list_items')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      setItems((data || []).map((row: any) => ({
        id: row.id,
        userId: row.user_id,
        name: row.name,
        quantity: row.quantity || '1',
        unit: row.unit || 'unité',
        price: row.price || 0,
        store: row.store || '',
        brand: row.brand || '',
        checked: row.checked || false,
        category: row.category || 'produce',
        note: row.note,
        photo: row.photo,
        createdAt: row.created_at,
      })));
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  const totalPrice = items.reduce((sum, item) => sum + (item.price || 0), 0);
  const uncheckedCount = items.filter(i => !i.checked).length;

  const toggleCheck = async (id: string) => {
    const item = items.find(i => i.id === id);
    if (!item) return;
    const checked = !item.checked;
    setItems(prev => prev.map(i => i.id === id ? { ...i, checked } : i));
    await supabase.from('shopping_list_items').update({ checked }).eq('id', id);
  };

  const removeItem = async (id: string) => {
    console.log('[removeItem] Removing id:', id);
    setItems(prev => prev.filter(i => i.id !== id));
    const result = await supabase.from('shopping_list_items').delete().eq('id', id);
    console.log('[removeItem] Result:', JSON.stringify(result));
  };

  const addItem = async (item: Omit<ShoppingListItem, 'userId' | 'createdAt'>, _stores?: string[]) => {
    if (!user) return;
    const newItem: ShoppingListItem = { ...item, userId: user.id };
    setItems(prev => [newItem, ...prev]);
    await supabase.from('shopping_list_items').upsert({
      id: item.id,
      user_id: user.id,
      name: item.name,
      quantity: item.quantity?.toString(),
      unit: item.unit,
      price: item.price,
      store: item.store,
      brand: (item as any).brand || '',
      checked: item.checked,
      category: item.category || 'produce',
      note: item.note,
      photo: item.photo,
    });
  };

  const updateItem = async (id: string, updates: Partial<ShoppingListItem>) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i));
    await supabase.from('shopping_list_items').update({
      name: updates.name,
      quantity: updates.quantity?.toString(),
      unit: updates.unit,
      category: updates.category,
      note: updates.note,
      photo: updates.photo,
    }).eq('id', id);
  };

  const clearChecked = async () => {
    const checkedIds = items.filter(i => i.checked).map(i => i.id);
    setItems(prev => prev.filter(i => !i.checked));
    if (checkedIds.length > 0) {
      await supabase.from('shopping_list_items').delete().in('id', checkedIds);
    }
  };

  const clearAll = async () => {
    if (!user) return;
    setItems([]);
    await supabase.from('shopping_list_items').delete().eq('user_id', user.id);
  };

  const refreshPrices = async (stores: string[]) => {
    console.log('[refreshPrices] stores:', stores, 'items:', items.length, 'user:', !!user);
    if (!user || items.length === 0) return;

    try {
      const [{ data: storesData }, { data: pantryData }] = await Promise.all([
        supabase.from('stores').select('id, code'),
        supabase.from('pantry_items').select('name').eq('user_id', user.id),
      ]);

      const storeIds = (storesData || [])
        .filter((s: any) => stores.length === 0 || stores.includes(s.code))
        .map((s: any) => s.id);

      const pantryNames = (pantryData || []).map((p: any) => p.name.toLowerCase());

      const searchNames = items.map(item =>
        item.name.replace(/œ/g, 'oe').replace(/æ/g, 'ae')
          .replace(/[àâä]/g, 'a').replace(/[éèêë]/g, 'e')
          .replace(/[îï]/g, 'i').replace(/[ôö]/g, 'o')
          .replace(/[ùûü]/g, 'u').replace(/ç/g, 'c')
          .split(' ')[0]
      );

      const { data: allProducts } = await supabase
        .from('products')
        .select('id, name, brand')
        .or(searchNames.map(n => `name.ilike.%${n}%`).join(','))
        .limit(100);

      const allProductIds = (allProducts || []).map((p: any) => p.id);
      const { data: allPrices } = await supabase
        .from('prices')
        .select('regular_price, sale_price, store_id, product_id')
        .in('product_id', allProductIds)
        .in('store_id', storeIds.length > 0 ? storeIds : (storesData || []).map((s: any) => s.id));

      const updatedItems = items.map(item => {
        const isInPantry = pantryNames.some(name =>
          item.name.toLowerCase().includes(name) || name.includes(item.name.toLowerCase())
        );
        if (isInPantry) return { ...item, price: 0, store: 'pantry', brand: '' };

        const searchName = item.name.replace(/œ/g, 'oe').replace(/[éèêë]/g, 'e')
          .replace(/[àâä]/g, 'a').replace(/ç/g, 'c').split(' ')[0].toLowerCase();

        const matchingProducts = (allProducts || []).filter((p: any) =>
          p.name.toLowerCase().includes(searchName)
        );
        const matchingIds = matchingProducts.map((p: any) => p.id);

        const relevantPrices = (allPrices || []).filter((p: any) =>
          matchingIds.includes(p.product_id)
        );

        const sorted = relevantPrices.sort((a: any, b: any) =>
          (a.sale_price || a.regular_price) - (b.sale_price || b.regular_price)
        );
        const cheapest = sorted[0];
        if (!cheapest) return { ...item, price: 0, store: '', brand: '' };

        const bestPrice = cheapest.sale_price || cheapest.regular_price;
        const bestStoreData = (storesData || []).find((s: any) => s.id === cheapest.store_id);
        const bestProduct = (allProducts || []).find((p: any) => p.id === cheapest.product_id);

        return {
          ...item,
          price: bestPrice,
          store: bestStoreData?.code || item.store,
          brand: bestProduct?.brand || bestProduct?.name || '',
        };
      });

      // Calculer le total hypothétique par épicerie
const storeTotals: Record<string, number> = {};
const storeItemCount: Record<string, number> = {};

for (const item of updatedItems) {
  const searchName = item.name.replace(/œ/g, 'oe').replace(/[éèêë]/g, 'e')
    .replace(/[àâä]/g, 'a').replace(/ç/g, 'c').split(' ')[0].toLowerCase();
  
  const matchingProducts = (allProducts || []).filter((p: any) =>
    p.name.toLowerCase().includes(searchName)
  );
  const matchingIds = matchingProducts.map((p: any) => p.id);

  const byStore: Record<string, number> = {};
  for (const price of (allPrices || []).filter((p: any) => matchingIds.includes(p.product_id))) {
    const cost = price.sale_price || price.regular_price;
    if (!byStore[price.store_id] || cost < byStore[price.store_id]) {
      byStore[price.store_id] = cost;
    }
  }
  for (const [storeId, cost] of Object.entries(byStore)) {
    const storeCode = (storesData || []).find((s: any) => s.id === storeId)?.code;
    if (storeCode) {
      storeTotals[storeCode] = (storeTotals[storeCode] || 0) + cost;
      storeItemCount[storeCode] = (storeItemCount[storeCode] || 0) + 1;
    }
  }
}

const bestStoreEntry = Object.entries(storeTotals)
  .filter(([code]) => storeItemCount[code] === Math.max(...Object.values(storeItemCount)))
  .sort((a, b) => a[1] - b[1])[0];
if (bestStoreEntry) {
  setBestStoreForList({ storeCode: bestStoreEntry[0], total: bestStoreEntry[1] });
}

      setItems(updatedItems);

      await Promise.all(updatedItems.map(item =>
        supabase.from('shopping_list_items')
          .update({ brand: (item as any).brand, store: item.store, price: item.price })
          .eq('id', item.id)
      ));

    } catch (err) {
      console.error('[refreshPrices] Error:', err);
    }
  };

  return (
    <ShoppingListContext.Provider value={{
      items, totalPrice, uncheckedCount, loading, bestStoreForList,
      toggleCheck, removeItem, addItem, updateItem, clearChecked, clearAll, refreshPrices,
    }}>
      {children}
    </ShoppingListContext.Provider>
  );
}

export function useShoppingList() {
  return useContext(ShoppingListContext);
}