import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows } from '@/constants/theme';
import { useAuth, useAlert } from '@/template';
import { useSubscription } from '@/hooks/useSubscription';
import { createCheckoutSession, createCustomerPortalSession } from '@/services/subscriptionService';
import { SUBSCRIPTION_TIERS } from '@/constants/subscription';
import { onboardingService } from '@/services/onboardingService';

export default function SubscriptionScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const { subscriptionStatus, loading, isSubscribed, isTrial, refreshSubscription } = useSubscription();
  const [processingPlan, setProcessingPlan] = useState<'monthly' | 'yearly' | null>(null);
  const [openingPortal, setOpeningPortal] = useState(false);
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);

  // Vérifier si l'onboarding est complet
  useEffect(() => {
    const checkOnboarding = async () => {
      if (!user) {
        setCheckingOnboarding(false);
        return;
      }

      const isComplete = await onboardingService.isOnboardingComplete(user.id);
      
      // Si l'onboarding n'est pas complet, rediriger vers l'onboarding
      if (!isComplete) {
        router.replace('/onboarding');
        return;
      }

      setCheckingOnboarding(false);
    };

    checkOnboarding();
  }, [user]);

  const handleSubscribe = async (tier: 'monthly' | 'yearly') => {
    if (!user) {
      showAlert('Erreur', 'Vous devez être connecté pour souscrire');
      return;
    }

    try {
      setProcessingPlan(tier);
      const priceId = SUBSCRIPTION_TIERS[tier].price_id;
      const { url, error } = await createCheckoutSession(priceId);

      if (error) {
        showAlert('Erreur', error);
        return;
      }

      if (url) {
        await Linking.openURL(url);
      }
    } catch (error: any) {
      console.error('Error in handleSubscribe:', error);
      showAlert('Erreur', error.message || 'Impossible de créer la session de paiement');
    } finally {
      setProcessingPlan(null);
    }
  };

const handleManageSubscription = async () => {
  try {
    await Linking.openURL('https://billing.stripe.com/p/login/00w3cpdicgg0dMObtG7Re00');
  } catch {
    showAlert('Erreur', 'Impossible d\'ouvrir le portail. Contactez-nous à hello@bonplan.co');
  }
};

  if (!user) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>Non connecté</Text>
        </View>
      </View>
    );
  }

  // Afficher un loader pendant la vérification de l'onboarding
  if (checkingOnboarding) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>Vérification...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.7 }]}
          hitSlop={12}
        >
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <View style={styles.headerTextContainer}>
          <Text style={styles.title}>Abonnement</Text>
          <Text style={styles.subtitle}>
            Accédez à toutes les fonctionnalités
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <>
            {/* Current Status */}
            {isSubscribed && (
              <View style={styles.statusCard}>
                <View style={styles.statusHeader}>
                  <MaterialIcons 
                    name={isTrial ? 'schedule' : 'check-circle'} 
                    size={32} 
                    color={isTrial ? colors.accent : '#ebcdf1'} 
                  />
                  <View style={styles.statusInfo}>
                    <Text style={styles.statusTitle}>
                      {isTrial ? 'Période d\'essai gratuite' : 'Abonnement actif'}
                    </Text>
                    {subscriptionStatus?.subscription_end && (
                      <Text style={styles.statusSubtitle}>
                        {isTrial ? 'Se termine le' : 'Renouvellement le'}{' '}
                        {new Date(subscriptionStatus.subscription_end).toLocaleDateString('fr-CA', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </Text>
                    )}
                  </View>
                </View>

                {isTrial && (
                  <View style={styles.trialBanner}>
                    <MaterialIcons name="info-outline" size={20} color={colors.accent} />
                    <Text style={styles.trialText}>
                      Profitez de 7 jours gratuits ! Votre abonnement débutera après la période d'essai.
                    </Text>
                  </View>
                )}

                <Pressable
                  onPress={handleManageSubscription}
                  disabled={openingPortal}
                  style={({ pressed }) => [
                    styles.manageButton,
                    pressed && { opacity: 0.9 },
                    openingPortal && { opacity: 0.6 },
                  ]}
                >
                  {openingPortal ? (
                    <ActivityIndicator size="small" color={colors.surface} />
                  ) : (
                    <>
                      <MaterialIcons name="settings" size={20} color={colors.surface} />
                      <Text style={styles.manageButtonText}>Gérer mon abonnement</Text>
                    </>
                  )}
                </Pressable>
              </View>
            )}

            {/* Features List */}
            <View style={styles.featuresCard}>
              <Text style={styles.sectionTitle}>
                {isSubscribed ? 'Vos fonctionnalités Premium' : 'Fonctionnalités Premium'}
              </Text>
              <View style={styles.featuresList}>
                {[
                  { icon: 'restaurant-menu', text: 'Recettes économiques par épicerie' },
                  { icon: 'calendar-today', text: 'Planificateur de menus hebdomadaires' },
                  { icon: 'shopping-cart', text: 'Listes de courses intelligentes' },
                  { icon: 'group', text: 'Partage de compte familial' },
                  { icon: 'local-offer', text: 'Circulaires et rabais' },
                  { icon: 'savings', text: 'Suivi des économies mensuelles' },
                ].map((feature, index) => (
                  <View key={index} style={styles.featureItem}>
                    <MaterialIcons name={feature.icon as any} size={24} color={'#ebcdf1'} />
                    <Text style={styles.featureText}>{feature.text}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Subscription Plans */}
            {!isSubscribed && (
              <>
                <Text style={styles.plansTitle}>Choisissez votre plan</Text>
                
                {/* Monthly Plan */}
                <View style={styles.planCard}>
                  <View style={styles.planHeader}>
                    <View>
                      <Text style={styles.planName}>Mensuel</Text>
                      <Text style={styles.planPrice}>
                        5$ <Text style={styles.planInterval}>/ mois</Text>
                      </Text>
                    </View>
                  </View>
                  <View style={styles.trialBadge}>
                    <MaterialIcons name="check-circle" size={16} color={'#ebcdf1'} />
                    <Text style={styles.trialBadgeText}>7 jours gratuits</Text>
                  </View>
                  <Pressable
                    onPress={() => handleSubscribe('monthly')}
                    disabled={processingPlan === 'monthly'}
                    style={({ pressed }) => [
                      styles.subscribeButton,
                      pressed && { opacity: 0.9 },
                      processingPlan === 'monthly' && { opacity: 0.6 },
                    ]}
                  >
                    {processingPlan === 'monthly' ? (
                      <ActivityIndicator size="small" color={colors.surface} />
                    ) : (
                      <Text style={styles.subscribeButtonText}>Commencer l'essai gratuit</Text>
                    )}
                  </Pressable>
                </View>

                {/* Yearly Plan */}
                <View style={[styles.planCard, styles.popularPlan]}>
                  <View style={styles.popularBadge}>
                    <Text style={styles.popularBadgeText}>ÉCONOMIE</Text>
                  </View>
                  <View style={styles.planHeader}>
                    <View>
                      <Text style={styles.planName}>Annuel</Text>
                      <Text style={styles.planPrice}>
                        50$ <Text style={styles.planInterval}>/ an</Text>
                      </Text>
                      <Text style={styles.savingsText}>Économisez 10$ par an</Text>
                    </View>
                  </View>
                  <View style={styles.trialBadge}>
                    <MaterialIcons name="check-circle" size={16} color={'#ebcdf1'} />
                    <Text style={styles.trialBadgeText}>7 jours gratuits</Text>
                  </View>
                  <Pressable
                    onPress={() => handleSubscribe('yearly')}
                    disabled={processingPlan === 'yearly'}
                    style={({ pressed }) => [
                      styles.subscribeButton,
                      styles.popularButton,
                      pressed && { opacity: 0.9 },
                      processingPlan === 'yearly' && { opacity: 0.6 },
                    ]}
                  >
                    {processingPlan === 'yearly' ? (
                      <ActivityIndicator size="small" color={colors.surface} />
                    ) : (
                      <Text style={styles.subscribeButtonText}>Commencer l'essai gratuit</Text>
                    )}
                  </Pressable>
                </View>

                {/* Free Access Info */}
                <View style={styles.freeAccessCard}>
                  <MaterialIcons name="info-outline" size={24} color={colors.textSecondary} />
                  <Text style={styles.freeAccessText}>
                    Sans abonnement, vous pouvez uniquement consulter la circulaire et les rabais.
                  </Text>
                </View>
              </>
            )}

            <Pressable
              onPress={refreshSubscription}
              style={({ pressed }) => [
                styles.refreshButton,
                pressed && { opacity: 0.7 },
              ]}
            >
              <MaterialIcons name="refresh" size={20} color={colors.primary} />
              <Text style={styles.refreshButtonText}>Actualiser le statut</Text>
            </Pressable>
          </>
        )}

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.background,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerTextContainer: {
    flex: 1,
  },
  title: {
    ...typography.h2,
    color: colors.text,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  loadingContainer: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
  },
  statusCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 2,
    borderColor: '#ebcdf1',
    ...shadows.md,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  statusInfo: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  statusSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  trialBanner: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.yellowLight,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  trialText: {
    flex: 1,
    ...typography.caption,
    color: colors.text,
    lineHeight: 18,
  },
  manageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  manageButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.surface,
  },
  featuresCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.md,
  },
  featuresList: {
    gap: spacing.md,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  featureText: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
  },
  plansTitle: {
    ...typography.h2,
    color: colors.text,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  planCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  popularPlan: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  popularBadge: {
    position: 'absolute',
    top: -12,
    right: spacing.lg,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  popularBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.surface,
  },
  planHeader: {
    marginBottom: spacing.md,
  },
  planName: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  planPrice: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.primary,
  },
  planInterval: {
    fontSize: 16,
    fontWeight: '400',
    color: colors.textSecondary,
  },
  savingsText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ebcdf1',
    marginTop: spacing.xs,
  },
  trialBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  trialBadgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ebcdf1',
  },
  subscribeButton: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  popularButton: {
    backgroundColor: colors.primary,
  },
  subscribeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.surface,
  },
  freeAccessCard: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.surfaceLight,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  freeAccessText: {
    flex: 1,
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  refreshButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  errorText: {
    ...typography.h3,
    color: colors.textSecondary,
  },
  loadingText: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
});
