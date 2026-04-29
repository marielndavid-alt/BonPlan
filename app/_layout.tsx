import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts, InstrumentSerif_400Regular, InstrumentSerif_400Regular_Italic } from '@expo-google-fonts/instrument-serif';
import { OpenSans_400Regular, OpenSans_500Medium, OpenSans_600SemiBold, OpenSans_700Bold } from '@expo-google-fonts/open-sans';
import { revenueCatService } from '@/services/revenueCatService';
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
  // Charge les fonts globalement pour que tous les écrans (Circulaires inclus,
  // qui ne load pas ses fonts) puissent les utiliser dès le 1er rendu.
  const [fontsLoaded] = useFonts({
    InstrumentSerif_400Regular,
    InstrumentSerif_400Regular_Italic,
    OpenSans_400Regular,
    OpenSans_500Medium,
    OpenSans_600SemiBold,
    OpenSans_700Bold,
  });

  useEffect(() => {
    revenueCatService.initialize();
  }, []);

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
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
