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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows } from '@/constants/theme';
import { dealDetailService, DealAlternative } from '@/services/dealDetailService';

export default function DealDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [deal, setDeal] = useState<DealAlternative | null>(null);
  const [alternatives, setAlternatives] = useState<DealAlternative[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDealDetails();
  }, [id]);

  const loadDealDetails = async () => {
    if (!id) return;

    setLoading(true);
    try {
      const data = await dealDetailService.getDealWithAlternatives(id as string);
      setDeal(data.deal);
      setAlternatives(data.alternatives);
    } catch (error) {
      console.error('Error loading deal details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenStoreLink = (url: string | null) => {
    if (!url) return;
    Linking.openURL(url).catch(err =>
      console.error('Error opening URL:', err)
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  if (!deal) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.errorText}>Produit non trouvé</Text>
      </View>
    );
  }

  const currentPrice = deal.sale_price || deal.regular_price;
  const bestAlternative = alternatives.length > 0 ? alternatives[0] : null;
  const bestPrice = bestAlternative
    ? bestAlternative.sale_price || bestAlternative.regular_price
    : currentPrice;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
          hitSlop={12}
        >
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Comparaison de prix
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Produit principal */}
        <View style={styles.mainProductCard}>
          <View
            style={[styles.storeBadge, { backgroundColor: deal.store_color }]}
          >
            <Text style={styles.storeBadgeText}>{deal.store_name.toUpperCase()}</Text>
          </View>

          <Text style={styles.productName}>{deal.product_name}</Text>

          {deal.image_url && (
            <View style={styles.imageContainer}>
              <Image
                source={{ uri: deal.image_url }}
                style={styles.productImage}
                contentFit="contain"
                transition={200}
              />
            </View>
          )}

          {deal.brand && (
            <Text style={styles.brandText}>Marque: {deal.brand}</Text>
          )}

          {deal.quantity && (
            <Text style={styles.quantityText}>{deal.quantity}</Text>
          )}

          <View style={styles.mainPriceSection}>
            <View style={styles.priceColumn}>
              <Text style={styles.priceLabel}>Prix actuel</Text>
              <View style={styles.priceRow}>
                {deal.is_on_sale && deal.sale_price && (
                  <>
                    <Text style={styles.regularPriceStrike}>
                      {deal.regular_price.toFixed(2)} $
                    </Text>
                    <Text style={styles.currentPriceMain}>
                      {deal.sale_price.toFixed(2)} $
                    </Text>
                  </>
                )}
                {!deal.is_on_sale && (
                  <Text style={styles.currentPriceMain}>
                    {deal.regular_price.toFixed(2)} $
                  </Text>
                )}
              </View>
            </View>

            {deal.is_on_sale && (
              <View style={styles.savingsBox}>
                <Text style={styles.savingsLabel}>Rabais</Text>
                <Text style={styles.savingsAmount}>-{deal.discount_percentage}%</Text>
                <Text style={styles.savingsValue}>
                  {deal.savings.toFixed(2)} $
                </Text>
              </View>
            )}
          </View>

          {deal.scrape_url && (
            <Pressable
              style={styles.visitStoreButton}
              onPress={() => handleOpenStoreLink(deal.scrape_url)}
            >
              <MaterialIcons name="open-in-new" size={20} color={colors.primary} />
              <Text style={styles.visitStoreText}>
                Voir chez {deal.store_name}
              </Text>
            </Pressable>
          )}
        </View>

        {/* Comparaison avec la meilleure alternative */}
        {bestAlternative && bestPrice < currentPrice && (
          <View style={styles.comparisonCard}>
            <MaterialIcons name="trending-down" size={24} color={colors.success} />
            <Text style={styles.comparisonText}>
              Économisez{' '}
              <Text style={styles.comparisonAmount}>
                {(currentPrice - bestPrice).toFixed(2)} $
              </Text>{' '}
              chez {bestAlternative.store_name}
            </Text>
          </View>
        )}

        {/* Liste des alternatives */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Disponible dans {alternatives.length} autres{' '}
            {alternatives.length > 1 ? 'épiceries' : 'épicerie'}
          </Text>

          {alternatives.length === 0 && (
            <View style={styles.emptyState}>
              <MaterialIcons name="shopping-basket" size={48} color={colors.textSecondary} />
              <Text style={styles.emptyText}>
                Aucune alternative trouvée dans les autres épiceries
              </Text>
            </View>
          )}

          {alternatives.map((alt, index) => (
            <Pressable
              key={alt.id}
              style={({ pressed }) => [
                styles.alternativeCard,
                index === 0 && styles.alternativeCardBest,
                pressed && { opacity: 0.8 },
              ]}
              onPress={() => alt.scrape_url && handleOpenStoreLink(alt.scrape_url)}
            >
              <View style={styles.alternativeHeader}>
                <View
                  style={[
                    styles.alternativeStoreBadge,
                    { backgroundColor: alt.store_color },
                  ]}
                >
                  <Text style={styles.alternativeStoreText}>
                    {alt.store_code.toUpperCase()}
                  </Text>
                </View>

                {index === 0 && (
                  <View style={styles.bestPriceBadge}>
                    <MaterialIcons name="star" size={16} color={colors.warning} />
                    <Text style={styles.bestPriceText}>Meilleur prix</Text>
                  </View>
                )}

                {alt.is_on_sale && (
                  <View style={styles.onSaleBadge}>
                    <Text style={styles.onSaleText}>-{alt.discount_percentage}%</Text>
                  </View>
                )}
              </View>

              <Text style={styles.alternativeProductName} numberOfLines={2}>
                {alt.product_name}
              </Text>

              {alt.brand && alt.brand !== deal.brand && (
                <Text style={styles.alternativeBrand}>{alt.brand}</Text>
              )}

              {alt.quantity && (
                <Text style={styles.alternativeQuantity}>{alt.quantity}</Text>
              )}

              <View style={styles.alternativePriceRow}>
                <View style={styles.alternativePrices}>
                  {alt.is_on_sale && alt.sale_price && (
                    <>
                      <Text style={styles.alternativeRegularPrice}>
                        {alt.regular_price.toFixed(2)} $
                      </Text>
                      <Text style={styles.alternativeSalePrice}>
                        {alt.sale_price.toFixed(2)} $
                      </Text>
                    </>
                  )}
                  {!alt.is_on_sale && (
                    <Text style={styles.alternativeCurrentPrice}>
                      {alt.regular_price.toFixed(2)} $
                    </Text>
                  )}
                </View>

                {alt.scrape_url && (
                  <MaterialIcons name="chevron-right" size={24} color={colors.textSecondary} />
                )}
              </View>

              <View style={styles.comparisonRow}>
                <Text
                  style={[
                    styles.comparisonVsMain,
                    (alt.sale_price || alt.regular_price) < currentPrice
                      ? styles.comparisonCheaper
                      : styles.comparisonExpensive,
                  ]}
                >
                  {(alt.sale_price || alt.regular_price) < currentPrice
                    ? `Économie: ${(currentPrice - (alt.sale_price || alt.regular_price)).toFixed(2)} $`
                    : `Plus cher: ${((alt.sale_price || alt.regular_price) - currentPrice).toFixed(2)} $`}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>

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
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.text,
    flex: 1,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  loadingText: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  errorText: {
    ...typography.h3,
    color: colors.textSecondary,
  },
  mainProductCard: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    ...shadows.sm,
  },
  storeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    marginBottom: spacing.md,
  },
  storeBadgeText: {
    ...typography.captionBold,
    color: colors.surface,
  },
  productName: {
    ...typography.h2,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  brandText: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  quantityText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  imageContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: borderRadius.lg,
    marginVertical: spacing.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  productImage: {
    width: 180,
    height: 180,
    backgroundColor: 'transparent',
  },
  mainPriceSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: spacing.md,
  },
  priceColumn: {
    flex: 1,
  },
  priceLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  regularPriceStrike: {
    ...typography.body,
    color: colors.textSecondary,
    textDecorationLine: 'line-through',
  },
  currentPriceMain: {
    ...typography.h1,
    color: colors.primary,
    fontWeight: '700',
  },
  savingsBox: {
    backgroundColor: colors.error,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  savingsLabel: {
    ...typography.caption,
    color: colors.surface,
  },
  savingsAmount: {
    ...typography.h2,
    color: colors.surface,
    fontWeight: '700',
  },
  savingsValue: {
    ...typography.caption,
    color: colors.surface,
  },
  visitStoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: borderRadius.md,
  },
  visitStoreText: {
    ...typography.bodyBold,
    color: colors.primary,
  },
  comparisonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.successLight,
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.success,
  },
  comparisonText: {
    ...typography.body,
    color: colors.success,
    flex: 1,
  },
  comparisonAmount: {
    ...typography.bodyBold,
    color: colors.success,
  },
  section: {
    padding: spacing.md,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.md,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  alternativeCard: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  alternativeCardBest: {
    borderColor: colors.warning,
    borderWidth: 2,
    ...shadows.sm,
  },
  alternativeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  alternativeStoreBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  alternativeStoreText: {
    ...typography.caption,
    color: colors.surface,
    fontWeight: '600',
  },
  bestPriceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.warningLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  bestPriceText: {
    ...typography.caption,
    color: colors.warning,
    fontWeight: '600',
  },
  onSaleBadge: {
    backgroundColor: colors.error,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    marginLeft: 'auto',
  },
  onSaleText: {
    ...typography.caption,
    color: colors.surface,
    fontWeight: '600',
  },
  alternativeProductName: {
    ...typography.bodyBold,
    color: colors.text,
    marginBottom: 4,
  },
  alternativeBrand: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  alternativeQuantity: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  alternativePriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  alternativePrices: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  alternativeRegularPrice: {
    ...typography.body,
    color: colors.textSecondary,
    textDecorationLine: 'line-through',
  },
  alternativeSalePrice: {
    ...typography.h3,
    color: colors.error,
    fontWeight: '700',
  },
  alternativeCurrentPrice: {
    ...typography.h3,
    color: colors.text,
    fontWeight: '700',
  },
  comparisonRow: {
    marginTop: spacing.xs,
  },
  comparisonVsMain: {
    ...typography.caption,
  },
  comparisonCheaper: {
    color: colors.success,
    fontWeight: '600',
  },
  comparisonExpensive: {
    color: colors.error,
    fontWeight: '600',
  },
});
