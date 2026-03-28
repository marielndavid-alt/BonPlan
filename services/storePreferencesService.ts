import { supabase } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SELECTED_STORES_KEY = 'selected_stores';
const DEFAULT_STORES = ['metro'];

export const storePreferencesService = {
  async getSelectedStores(userId?: string): Promise<string[]> {
    try {
      if (userId) {
        const { data } = await supabase
          .from('user_preferences')
          .select('selected_stores')
          .eq('user_id', userId)
          .single();

        if (data?.selected_stores?.length > 0) {
          return data.selected_stores;
        }
      }

      // Fallback to local storage
      const stored = await AsyncStorage.getItem(SELECTED_STORES_KEY);
      return stored ? JSON.parse(stored) : DEFAULT_STORES;
    } catch {
      return DEFAULT_STORES;
    }
  },

  async setSelectedStores(userId: string, stores: string[]): Promise<void> {
    try {
      await AsyncStorage.setItem(SELECTED_STORES_KEY, JSON.stringify(stores));

      await supabase
        .from('user_preferences')
        .upsert({ user_id: userId, selected_stores: stores }, { onConflict: 'user_id' });
    } catch (err) {
      console.error('[StorePreferences] Error saving:', err);
    }
  },

  async toggleStore(userId: string, storeCode: string): Promise<string[]> {
    const current = await this.getSelectedStores(userId);
    const updated = current.includes(storeCode)
      ? current.filter(s => s !== storeCode)
      : [...current, storeCode];

    await this.setSelectedStores(userId, updated);
    return updated;
  },
};
