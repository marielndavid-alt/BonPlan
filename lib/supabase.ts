import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

const storage = Platform.OS === 'web' ? {
  getItem: (key: string) => {
    try { return Promise.resolve(typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null); }
    catch { return Promise.resolve(null); }
  },
  setItem: (key: string, value: string) => {
    try { if (typeof localStorage !== 'undefined') localStorage.setItem(key, value); }
    catch {}
    return Promise.resolve();
  },
  removeItem: (key: string) => {
    try { if (typeof localStorage !== 'undefined') localStorage.removeItem(key); }
    catch {}
    return Promise.resolve();
  },
} : require('@react-native-async-storage/async-storage').default;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
});
