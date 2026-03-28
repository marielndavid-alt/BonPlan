import React from 'react';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, AlertProvider, configManager, createConfig } from '@/template';
import { SubscriptionProvider } from '@/contexts/SubscriptionContext';
import { ShoppingListProvider } from '@/contexts/ShoppingListContext';
import { PantryProvider } from '@/contexts/PantryContext';
import { WeeklyMenuProvider } from '@/contexts/WeeklyMenuContext';

configManager.initialize(createConfig({
  auth: { enabled: true, profileTableName: 'user_profiles' }
}));

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AlertProvider>
        <AuthProvider>
          <SubscriptionProvider>
            <PantryProvider>
              <WeeklyMenuProvider>
                <ShoppingListProvider>
                  <Stack screenOptions={{ headerShown: false }}>
                    <Stack.Screen name="index" />
                    <Stack.Screen name="onboarding" />
                    <Stack.Screen name="(tabs)" />
                    <Stack.Screen name="recipe/[id]" />
                    <Stack.Screen name="ingredient/[id]" />
                    <Stack.Screen name="deal/[id]" />
                    <Stack.Screen name="login" />
                    <Stack.Screen name="profile" />
                    <Stack.Screen name="store-preferences" />
                    <Stack.Screen name="household-members" />
                    <Stack.Screen name="subscription" />
                    <Stack.Screen name="preferences" />
                    <Stack.Screen name="scrape-ingredient" />
                    <Stack.Screen name="pantry" />
                  </Stack>
                </ShoppingListProvider>
              </WeeklyMenuProvider>
            </PantryProvider>
          </SubscriptionProvider>
        </AuthProvider>
      </AlertProvider>
    </SafeAreaProvider>
  );
}
