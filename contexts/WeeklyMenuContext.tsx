import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/template';

const WeeklyMenuContext = createContext<any>(null);

export function WeeklyMenuProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (user) loadMenu(); }, [user]);

  const loadMenu = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase.from('weekly_menus').select('*, recipes(*)').eq('user_id', user.id);
    setMenuItems(data || []);
    setLoading(false);
  };

  const addMenuItem = async (item: any) => {
  console.log('[addMenuItem] adding:', item);
  if (!user) return;
  const { data, error } = await supabase.from('weekly_menus').insert({ 
  recipe_id: item.recipeId || item.recipe_id,
  title: item.title,
  servings: item.servings,
  total_price: item.totalPrice,
  user_id: user.id 
}).select().single();
  console.log('[addMenuItem] result:', JSON.stringify(data), 'error:', JSON.stringify(error));
  if (data) setMenuItems(prev => [...prev, data]);
};

  const removeMenuItem = async (id: string) => {
    await supabase.from('weekly_menus').delete().eq('id', id);
    setMenuItems(prev => prev.filter(i => i.id !== id));
  };

  const clearMenu = async () => {
    if (!user) return;
    await supabase.from('weekly_menus').delete().eq('user_id', user.id);
    setMenuItems([]);
  };

  const totalCost = menuItems.reduce((sum, item) => sum + (item.total_price || 0), 0);

  const updateDay = async (id: string, day: string) => {
  const { error } = await supabase
    .from('weekly_menus')
    .update({ day })
    .eq('id', id);
  if (!error) {
    setMenuItems(prev => prev.map(item => 
      item.id === id ? { ...item, day } : item
    ));
  }
};

  return (
<WeeklyMenuContext.Provider value={{ menuItems, loading, addMenuItem, removeMenuItem, clearMenu, refreshMenu: loadMenu, totalCost, updateDay }}>
  {children}
</WeeklyMenuContext.Provider>
  );
}

export function useWeeklyMenu() {
  const ctx = useContext(WeeklyMenuContext);
  if (!ctx) throw new Error('useWeeklyMenu must be used within WeeklyMenuProvider');
  return ctx;
}
