import React, { useState, useEffect } from 'react';
import { Redirect } from 'expo-router';
import { onboardingService } from '@/services/onboardingService';
import { View, Image, StyleSheet, Dimensions, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/template';

const { width, height } = Dimensions.get('window');

export default function RootScreen() {
  const { user, loading: authLoading } = useAuth();
  const [checking, setChecking] = useState(true);
  const [shouldShowOnboarding, setShouldShowOnboarding] = useState(false);

  useEffect(() => {
    let isMounted = true;

    // Timeout de sécurité - max 5 secondes peu importe ce qui se passe
    const safetyTimeout = setTimeout(() => {
      if (isMounted) setChecking(false);
    }, 5000);

    const checkOnboarding = async () => {
      if (authLoading) return;

      const url = await Linking.getInitialURL();
      if (url) {
        const match = url.match(/ref=([A-Z0-9]+)/);
        if (match) await AsyncStorage.setItem('pending_referral_code', match[1]);
      }

      if (user) {
        // Onboarding seulement pour les nouveaux comptes (créés dans les 5 dernières minutes)
        const createdAt = new Date(user.created_at || 0);
        const isNewAccount = (Date.now() - createdAt.getTime()) < 5 * 60 * 1000;
        const isComplete = await onboardingService.isOnboardingComplete(user.id);
        if (!isMounted) return;
        if (!isComplete && isNewAccount) setShouldShowOnboarding(true);
      }

      if (isMounted) {
        clearTimeout(safetyTimeout);
        setTimeout(() => setChecking(false), 2500);
      }
    };

    checkOnboarding();
    return () => { isMounted = false; clearTimeout(safetyTimeout); };
  }, [user, authLoading]);

  if (checking || authLoading) {
    return (
      <View style={styles.container}>
        <Image
          source={require('../assets/images/Icon accueil-rouge.gif')}
          style={styles.image}
          resizeMode="cover"
        />
      </View>
    );
  }

  if (user && shouldShowOnboarding) return <Redirect href="/onboarding" />;
  if (user && !shouldShowOnboarding) return <Redirect href="/(tabs)/shopping" />;
  return <Redirect href="/login" />;
}

const styles = StyleSheet.create({
  container: { flex: 1, width, height },
  image: { width: '100%', height: '100%' },
});
