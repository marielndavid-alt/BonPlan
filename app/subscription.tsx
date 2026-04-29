import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows } from '@/constants/theme';
import { useAuth, useAlert } from '@/template';
import { useSubscription } from '@/hooks/useSubscription';
import { revenueCatService } from '@/services/revenueCatService';
import type { PurchasesPackage } from 'react-native-purchases';

export default function SubscriptionScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const { subscriptionStatus, loading, isSubscribed, isTrial, refreshSubscription } = useSubscription();
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [processingPlan, setProcessingPlan] = useState<string | null>(null);
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);

  useEffect(() => {
    setCheckingOnboarding(false);
  }, []);

  useEffect(() => {
    const loadOfferings = async () => {
      // setUserId déjà appelé par SubscriptionContext sur user?.id change
      const offering = await revenueCatService.getOfferings();
      if (offering?.availablePackages) setPackages(offering.availablePackages);
    };
    loadOfferings();
  }, [user]);

  const handleSubscribe = async (pkg: PurchasesPackage) => {
    try {
      setProcessingPlan(pkg.identifier);
      const { success, error } = await revenueCatService.purchasePackage(pkg);
      if (success) {
        await refreshSubscription();
        showAlert('Succès', 'Votre abonnement est maintenant actif !');
      } else if (error && !error.userCancelled) {
        // Message plus précis selon le type d'erreur RevenueCat
        const code = error?.code || error?.userInfo?.readable_error_code;
        let msg = "Impossible de compléter l'achat. Veuillez réessayer.";
        if (code === 'PRODUCT_NOT_AVAILABLE_FOR_PURCHASE' || code === 'PURCHASE_NOT_ALLOWED_ERROR') {
          msg = "Ce forfait n'est pas disponible pour le moment. Réessayez plus tard.";
        } else if (code === 'NETWORK_ERROR') {
          msg = "Problème de connexion. Vérifiez votre internet et réessayez.";
        } else if (code === 'STORE_PROBLEM_ERROR' || code === 'PAYMENT_PENDING_ERROR') {
          msg = "Problème avec l'App Store. Réessayez dans quelques minutes.";
        } else if (error?.message) {
          msg = error.message;
        }
        showAlert('Erreur', msg);
      }
    } finally {
      setProcessingPlan(null);
    }
  };

  const handleRestore = async () => {
    setProcessingPlan('restore');
    const customerInfo = await revenueCatService.restorePurchases();
    if (customerInfo) {
      await refreshSubscription();
      showAlert('Succès', 'Vos achats ont été restaurés.');
    } else {
      showAlert('Info', 'Aucun achat trouvé à restaurer.');
    }
    setProcessingPlan(null);
  };

  const handleManageSubscription = async () => {
    try {
      await Linking.openURL('https://apps.apple.com/account/subscriptions');
    } catch {
      showAlert('Erreur', 'Impossible d\'ouvrir les paramètres.');
    }
  };

  if (!user) return null;
  if (checkingOnboarding) return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={12}>
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <View style={styles.headerTextContainer}>
          <Text style={styles.title}>Abonnement</Text>
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <>
            {isSubscribed && (
              <View style={styles.statusCard}>
                <View style={styles.statusHeader}>
                  <MaterialIcons name={isTrial ? 'schedule' : 'check-circle'} size={32} color={isTrial ? colors.accent : '#ebcdf1'} />
                  <View style={styles.statusInfo}>
                    <Text style={styles.statusTitle}>{isTrial ? "Période d'essai gratuite" : "Abonnement actif"}</Text>
                    {subscriptionStatus?.subscription_end && (
                      <Text style={styles.statusSubtitle}>
                        {isTrial ? 'Se termine le' : 'Renouvellement le'}{' '}
                        {new Date(subscriptionStatus.subscription_end).toLocaleDateString('fr-CA', { year: 'numeric', month: 'long', day: 'numeric' })}
                      </Text>
                    )}
                  </View>
                </View>
                <Pressable onPress={handleManageSubscription} style={styles.manageButton}>
                  <MaterialIcons name="settings" size={20} color={colors.surface} />
                  <Text style={styles.manageButtonText}>Gérer mon abonnement</Text>
                </Pressable>
              </View>
            )}

            <View style={styles.featuresCard}>
              <Text style={styles.sectionTitle}>{isSubscribed ? 'Vos fonctionnalités Premium' : 'Fonctionnalités Premium'}</Text>
              <View style={styles.featuresList}>
                {[
                  { icon: 'restaurant-menu', text: 'Recettes économiques par épicerie' },
                  { icon: 'calendar-today', text: 'Planificateur de menus hebdomadaires' },
                  { icon: 'shopping-cart', text: 'Listes de courses intelligentes' },
                  { icon: 'group', text: 'Partage de compte familial' },
                  { icon: 'local-offer', text: 'Circulaires et rabais' },
                ].map((feature, index) => (
                  <View key={index} style={styles.featureItem}>
                    <MaterialIcons name={feature.icon as any} size={24} color={'#ebcdf1'} />
                    <Text style={styles.featureText}>{feature.text}</Text>
                  </View>
                ))}
              </View>
            </View>

            {!isSubscribed && (
              <>
                <Text style={styles.plansTitle}>Choisissez votre plan</Text>
                {packages.map((pkg) => {
                  const isYearly = pkg.identifier.toLowerCase().includes('annual') || pkg.identifier.toLowerCase().includes('yearly') || pkg.identifier === '$rc_annual';
                  return (
                    <View key={pkg.identifier} style={[styles.planCard, isYearly && styles.popularPlan]}>
                      {isYearly && (
                        <View style={styles.popularBadge}>
                          <Text style={styles.popularBadgeText}>ÉCONOMIE</Text>
                        </View>
                      )}
                      <View style={styles.planHeader}>
                        <Text style={styles.planName}>{pkg.product.title || (isYearly ? 'Annuel' : 'Mensuel')}</Text>
                        <Text style={styles.planPrice}>{pkg.product.priceString} <Text style={styles.planInterval}>{isYearly ? '/ an' : '/ mois'}</Text></Text>
                        {isYearly && <Text style={styles.savingsText}>Économisez 10$ par an</Text>}
                      </View>
                      <View style={styles.trialBadge}>
                        <MaterialIcons name="check-circle" size={16} color={'#ebcdf1'} />
                        <Text style={styles.trialBadgeText}>7 jours gratuits</Text>
                      </View>
                      <Pressable
                        onPress={() => handleSubscribe(pkg)}
                        disabled={processingPlan === pkg.identifier}
                        style={[styles.subscribeButton, isYearly && styles.popularButton, processingPlan === pkg.identifier && { opacity: 0.6 }]}
                      >
                        {processingPlan === pkg.identifier
                          ? <ActivityIndicator size="small" color={colors.surface} />
                          : <Text style={styles.subscribeButtonText}>Commencer l'essai gratuit</Text>}
                      </Pressable>
                    </View>
                  );
                })}
                <View style={styles.freeAccessCard}>
                  <MaterialIcons name="info-outline" size={24} color={colors.textSecondary} />
                  <Text style={styles.freeAccessText}>Sans abonnement, vous pouvez uniquement consulter la circulaire et les rabais.</Text>
                </View>
              </>
            )}

            <Pressable onPress={handleRestore} disabled={processingPlan === 'restore'} style={styles.refreshButton}>
              {processingPlan === 'restore'
                ? <ActivityIndicator size="small" color={colors.primary} />
                : <><MaterialIcons name="restore" size={20} color={colors.primary} /><Text style={styles.refreshButtonText}>Restaurer mes achats</Text></>}
            </Pressable>
          </>
        )}
        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  backButton: { padding: spacing.xs },
  headerTextContainer: { flex: 1 },
  title: { fontSize: 36, fontWeight: '400', color: colors.text, fontFamily: 'InstrumentSerif_400Regular', textAlign: 'center' },
  subtitle: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },
  scrollView: { flex: 1 },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  loadingContainer: { paddingVertical: spacing.xxl, alignItems: 'center' },
  statusCard: { backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.lg, marginBottom: spacing.lg, borderWidth: 2, borderColor: '#ebcdf1' },
  statusHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  statusInfo: { flex: 1 },
  statusTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 4 },
  statusSubtitle: { ...typography.caption, color: colors.textSecondary },
  manageButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.accent, paddingVertical: spacing.md, borderRadius: borderRadius.md },
  manageButtonText: { fontSize: 16, fontWeight: '600', color: colors.surface },
  featuresCard: { backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.lg, marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.border },
  sectionTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.md },
  featuresList: { gap: spacing.md },
  featureItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  featureText: { flex: 1, fontSize: 16, color: colors.text },
  plansTitle: { ...typography.h2, color: colors.text, marginBottom: spacing.md, textAlign: 'center' },
  planCard: { backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  popularPlan: { borderWidth: 2, borderColor: colors.primary },
  popularBadge: { position: 'absolute', top: -12, right: spacing.lg, backgroundColor: colors.primary, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.sm },
  popularBadgeText: { fontSize: 12, fontWeight: '700', color: colors.surface },
  planHeader: { marginBottom: spacing.md },
  planName: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  planPrice: { fontSize: 32, fontWeight: '700', color: colors.primary },
  planInterval: { fontSize: 16, fontWeight: '400', color: colors.textSecondary },
  savingsText: { fontSize: 14, fontWeight: '600', color: '#ebcdf1', marginTop: spacing.xs },
  trialBadge: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.md },
  trialBadgeText: { fontSize: 14, fontWeight: '600', color: '#ebcdf1' },
  subscribeButton: { backgroundColor: colors.accent, paddingVertical: spacing.md, borderRadius: borderRadius.md, alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  popularButton: { backgroundColor: colors.primary },
  subscribeButtonText: { fontSize: 16, fontWeight: '600', color: colors.surface },
  freeAccessCard: { flexDirection: 'row', gap: spacing.md, backgroundColor: colors.surfaceLight, borderRadius: borderRadius.lg, padding: spacing.lg, marginTop: spacing.md, marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.border },
  freeAccessText: { flex: 1, ...typography.caption, color: colors.textSecondary, lineHeight: 20 },
  refreshButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  refreshButtonText: { fontSize: 16, fontWeight: '600', color: colors.primary },
});
