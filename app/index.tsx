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
    
    const checkOnboarding = async () => {
      if (authLoading) return;

      // Capturer le code de parrainage depuis le deep link
      const url = await Linking.getInitialURL();
      if (url) {
        const match = url.match(/ref=([A-Z0-9]+)/);
        if (match) {
          await AsyncStorage.setItem('pending_referral_code', match[1]);
        }
      }
      
      if (user) {
        const isComplete = await onboardingService.isOnboardingComplete(user.id);
        if (!isMounted) return;
        if (!isComplete) setShouldShowOnboarding(true);
      }
      
      if (isMounted) {
        setTimeout(() => setChecking(false), 2500);
      }
    };
    
    checkOnboarding();
    return () => { isMounted = false; };
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