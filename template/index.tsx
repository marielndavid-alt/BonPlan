/**
 * @/template - Replacement for OnSpace's proprietary SDK
 * This module provides the same API as the original @/template module
 * but using real Supabase and React Native primitives.
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Modal, View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { supabase } from '@/lib/supabase';
import { UserProfile } from '@/types';

// ─── Supabase Client ──────────────────────────────────────────────────────────

export function getSupabaseClient() {
  return supabase;
}

// ─── Config Manager ───────────────────────────────────────────────────────────

interface AppConfig {
  auth?: {
    enabled?: boolean;
    profileTableName?: string;
  };
}

class ConfigManager {
  private config: AppConfig = {};

  initialize(config: AppConfig) {
    this.config = config;
  }

  get() {
    return this.config;
  }
}

export const configManager = new ConfigManager();

export function createConfig(config: AppConfig): AppConfig {
  return config;
}

// ─── Alert Context ────────────────────────────────────────────────────────────

type AlertButton = {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
};

type AlertContextType = {
  showAlert: (title: string, message?: string, buttons?: AlertButton[]) => void;
};

const AlertContext = createContext<AlertContextType>({
  showAlert: (title, message) => Alert.alert(title, message),
});

export function AlertProvider({ children }: { children: React.ReactNode }) {
  const [alertState, setAlertState] = useState<{
    visible: boolean;
    title: string;
    message?: string;
    buttons: AlertButton[];
  }>({ visible: false, title: '', buttons: [] });

  const showAlert = useCallback((title: string, message?: string, buttons?: AlertButton[]) => {
    // Use native Alert on mobile for simplicity
    const nativeButtons = (buttons || [{ text: 'OK' }]).map(btn => ({
      text: btn.text,
      style: btn.style as any,
      onPress: btn.onPress,
    }));
    Alert.alert(title, message, nativeButtons);
  }, []);

  return (
    <AlertContext.Provider value={{ showAlert }}>
      {children}
    </AlertContext.Provider>
  );
}

export function useAlert() {
  return useContext(AlertContext);
}

// ─── Auth Context ─────────────────────────────────────────────────────────────

type AuthUser = {
  id: string;
  email: string;
  username?: string;
};

type AuthContextType = {
  user: AuthUser | null;
  loading: boolean;
  operationLoading: boolean;
  signInWithPassword: (email: string, password: string) => Promise<{ error?: string; user?: AuthUser }>;
  signInWithGoogle: () => Promise<{ error?: string }>;
  signUp: (email: string, password: string, username?: string) => Promise<{ error?: string; user?: AuthUser }>;
  logout: () => Promise<{ error?: string }>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  operationLoading: false,
  signInWithPassword: async () => ({ error: 'Not initialized' }),
  signInWithGoogle: async () => ({ error: 'Not initialized' }),
  signUp: async () => ({ error: 'Not initialized' }),
  logout: async () => ({}),
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [operationLoading, setOperationLoading] = useState(false);

  const fetchProfile = async (userId: string, email: string): Promise<AuthUser> => {
    try {
      const config = configManager.get();
      const tableName = config.auth?.profileTableName || 'user_profiles';
      const { data } = await supabase
        .from(tableName)
        .select('username, avatar_url')
        .eq('id', userId)
        .single();
      return { id: userId, email, username: data?.username };
    } catch {
      return { id: userId, email };
    }
  };

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const profile = await fetchProfile(session.user.id, session.user.email || '');
        setUser(profile);
      }
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const profile = await fetchProfile(session.user.id, session.user.email || '');
        setUser(profile);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithPassword = async (email: string, password: string) => {
    setOperationLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { error: error.message };
      if (data.user) {
        const profile = await fetchProfile(data.user.id, data.user.email || '');
        setUser(profile);
        return { user: profile };
      }
      return { error: 'Connexion échouée' };
    } finally {
      setOperationLoading(false);
    }
  };

  const signUp = async (email: string, password: string, username?: string) => {
    setOperationLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) return { error: error.message };
      if (data.user) {
        // Create profile
        const config = configManager.get();
        const tableName = config.auth?.profileTableName || 'user_profiles';
        await supabase.from(tableName).upsert({
          id: data.user.id,
          email,
          username: username || email.split('@')[0],
        });
        const profile = { id: data.user.id, email, username: username || email.split('@')[0] };
        setUser(profile);
        return { user: profile };
      }
      return { error: 'Inscription échouée' };
    } finally {
      setOperationLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
      if (error) return { error: error.message };
      return {};
    } catch (err: any) {
      return { error: err.message };
    }
  };

  const logout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) return { error: error.message };
      setUser(null);
      return {};
    } catch (err: any) {
      return { error: err.message };
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, operationLoading, signInWithPassword, signInWithGoogle, signUp, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
