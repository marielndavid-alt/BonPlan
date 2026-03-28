import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/template';
import { PantryItem } from '@/types';

interface PantryContextType {
  items: PantryItem[];
  loading: boolean;
  addItem: (item: Omit<PantryItem, 'id' | 'userId' | 'createdAt'>) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  updateItem: (id: string, updates: Partial<PantryItem>) => Promise<void>;
  refresh: () => void;
}

const PantryContext = createContext<PantryContextType>({
  items: [],
  loading: false,
  addItem: async () => {},
  removeItem: async () => {},
  updateItem: async () => {},
  refresh: () => {},
});

export function PantryProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [items, setItems] = useState<PantryItem[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!user) { setItems([]); return; }
    setLoading(true);
    try {
      const { data } = await supabase
        .from('pantry_items')
        .select('*')
        .eq('user_id', user.id)
        .order('name');

      setItems((data || []).map((row: any) => ({
        id: row.id,
        userId: row.user_id,
        name: row.name,
        quantity: row.quantity,
        unit: row.unit,
        expiryDate: row.expiry_date,
        createdAt: row.created_at,
      })));
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  const addItem = async (item: Omit<PantryItem, 'id' | 'userId' | 'createdAt'>) => {
    if (!user) return;
    const { data } = await supabase.from('pantry_items').insert({
      user_id: user.id,
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      expiry_date: item.expiryDate,
    }).select().single();

    if (data) {
      setItems(prev => [...prev, { id: data.id, userId: user.id, ...item }]);
    }
  };

  const removeItem = async (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
    await supabase.from('pantry_items').delete().eq('id', id);
  };

  const updateItem = async (id: string, updates: Partial<PantryItem>) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i));
    await supabase.from('pantry_items').update({
      name: updates.name,
      quantity: updates.quantity,
      unit: updates.unit,
      expiry_date: updates.expiryDate,
    }).eq('id', id);
  };

  return (
    <PantryContext.Provider value={{ items, loading, addItem, removeItem, updateItem, refresh: load }}>
      {children}
    </PantryContext.Provider>
  );
}

export function usePantry() {
  return useContext(PantryContext);
}
