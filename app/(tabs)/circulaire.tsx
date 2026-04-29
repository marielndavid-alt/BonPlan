import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator,
  RefreshControl, Pressable, Modal, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { colors, spacing, typography, borderRadius, storeInfo } from '@/constants/theme';
import { circularService, Deal } from '@/services/circularService';
import { DealCard } from '@/components/feature/DealCard';

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList);
const COLLAPSE = 70;

function Shimmer({ style }: { style?: any }) {
  const opacity = useSharedValue(0.55);
  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 850 }), -1, true);
  }, [opacity]);
  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[{ backgroundColor: '#ECE6DF', borderRadius: 6 }, style, animatedStyle]} />;
}

function SkeletonCard({ aspectRatio }: { aspectRatio: number }) {
  return (
    <View style={{
      backgroundColor: colors.surface,
      padding: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 8,
    }}>
      <Shimmer style={{ width: '100%', aspectRatio, borderRadius: 7 }} />
      <Shimmer style={{ width: 44, height: 16, borderRadius: 4 }} />
      <Shimmer style={{ width: '85%', height: 13 }} />
      <Shimmer style={{ width: '50%', height: 11 }} />
      <Shimmer style={{ width: '40%', height: 18, marginTop: 4 }} />
    </View>
  );
}

const STORES = [
  { code: 'all', name: 'Tous' },
  { code: 'metro', name: 'Metro' },
  { code: 'iga', name: 'IGA' },
  { code: 'superc', name: 'Super C' },
  { code: 'maxi', name: 'Maxi' },
  { code: 'walmart', name: 'Walmart' },
];

const CATEGORIES = [
  { key: 'all', label: 'Tous' },
  { key: 'meat', label: 'Viandes' },
  { key: 'produce-vegetables', label: 'Légumes' },
  { key: 'produce-fruits', label: 'Fruits' },
  { key: 'dairy', label: 'Laitiers' },
  { key: 'pantry', label: 'Garde-Manger' },
  { key: 'frozen', label: 'Produits congelés' },
];

const DISCOUNT_RANGES = [
  { key: 'all', label: 'Tous' },
  { key: '20', label: '20%+' },
  { key: '50', label: '50%+' },
];

const PRICE_RANGES = [
  { key: 'all', label: 'Tous' },
  { key: '10', label: 'Moins de 10$' },
  { key: '20', label: 'Moins de 20$' },
];

export default function CircularScreen() {
  const insets = useSafeAreaInsets();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [filteredDeals, setFilteredDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const [selectedStore, setSelectedStore] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedDiscount, setSelectedDiscount] = useState('all');
  const [selectedPrice, setSelectedPrice] = useState('all');
  const [visibleCount, setVisibleCount] = useState(20);

  // Reset pagination quand les filtres changent
  useEffect(() => {
    setVisibleCount(20);
  }, [selectedStore, selectedCategory, selectedDiscount, selectedPrice]);

  const visibleDeals = filteredDeals.slice(0, visibleCount);

  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  const topRowStyle = useAnimatedStyle(() => ({
    height: interpolate(scrollY.value, [0, 60], [52, 0], Extrapolation.CLAMP),
  }));


  useFocusEffect(
    React.useCallback(() => { loadDeals(); }, [])
  );

  useEffect(() => {
    let filtered = [...deals];

    if (selectedStore !== 'all') {
      filtered = filtered.filter(d => d.store_code === selectedStore);
    }

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(d => {
        const cat = d.product_category?.toLowerCase() || '';
        switch (selectedCategory) {
          case 'meat': return cat === 'viandes';
          case 'fish': return cat === 'poissons et fruits de mer';
          case 'produce-vegetables': return cat === 'légumes';
          case 'produce-fruits': return cat === 'fruits';
          case 'dairy': return cat === 'produits laitiers';
          case 'frozen': return cat === 'surgelés';
          case 'pantry': return ['garde-manger','boissons','boulangerie'].includes(cat);
          case 'pantry': return ['garde-manger','boissons','boulangerie','surgelés'].includes(cat);
          default: return true;
        }
      });
    }

    if (selectedDiscount !== 'all') {
      const minDiscount = parseInt(selectedDiscount);
      filtered = filtered.filter(d => {
        const pct = d.discount_percentage || (d.original_price && d.sale_price
          ? ((d.original_price - d.sale_price) / d.original_price) * 100 : 0);
        return pct >= minDiscount;
      });
    }

    if (selectedPrice !== 'all') {
      const maxPrice = parseInt(selectedPrice);
      filtered = filtered.filter(d => (d.sale_price || d.original_price || 0) <= maxPrice);
    }

    filtered.sort((a, b) => {
      const da = a.discount_percentage || (a.original_price && a.sale_price ? ((a.original_price - a.sale_price) / a.original_price) * 100 : 0);
      const db = b.discount_percentage || (b.original_price && b.sale_price ? ((b.original_price - b.sale_price) / b.original_price) * 100 : 0);
      return db - da;
    });

    setFilteredDeals(filtered);
  }, [selectedStore, selectedCategory, selectedDiscount, selectedPrice, deals]);

  const loadDeals = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await circularService.getWeeklyDeals();
      setDeals(data);
      setFilteredDeals(data);
    } catch (error: any) {
      setError(error?.message || JSON.stringify(error));
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDeals();
    setRefreshing(false);
  };

  const activeFiltersCount = [
    selectedCategory !== 'all',
    selectedDiscount !== 'all',
    selectedPrice !== 'all',
  ].filter(Boolean).length;

  const resetFilters = () => {
    setSelectedStore('all');
    setSelectedCategory('all');
    setSelectedDiscount('all');
    setSelectedPrice('all');
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + spacing.md, paddingBottom: spacing.lg }]}>
          <View style={styles.headerTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Circulaire</Text>
              <Shimmer style={{ width: 140, height: 12, marginTop: 6 }} />
            </View>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: spacing.md, paddingTop: spacing.md }}>
          <View style={{ flex: 1, gap: 8 }}>
            <SkeletonCard aspectRatio={4 / 3} />
            <SkeletonCard aspectRatio={1} />
            <SkeletonCard aspectRatio={5 / 4} />
          </View>
          <View style={{ flex: 1, gap: 8 }}>
            <SkeletonCard aspectRatio={1} />
            <SkeletonCard aspectRatio={5 / 4} />
            <SkeletonCard aspectRatio={4 / 3} />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Animated.View style={[styles.headerTop, topRowStyle, { overflow: 'hidden' }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Circulaire</Text>
            <Text style={styles.dealsCount} numberOfLines={1}>
              {filteredDeals.length} rabais cette semaine
            </Text>
          </View>
          <Pressable style={styles.filterButton} onPress={() => setShowFilters(true)}>
            <MaterialIcons name="tune" size={20} color={colors.text} />
            {activeFiltersCount > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFiltersCount}</Text>
              </View>
            )}
          </Pressable>
        </Animated.View>

        {/* Onglets épiceries */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.storeTabsContent}
          style={styles.storeTabsScroll}
        >
          {STORES.map((s) => {
            const isActive = selectedStore === s.code;
            return (
              <Pressable
                key={s.code}
                onPress={() => setSelectedStore(s.code)}
                style={[styles.storeTab, isActive && styles.storeTabActive]}
              >
                <Text style={[styles.storeTabText, isActive && styles.storeTabTextActive]}>
                  {s.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Liste — masonry à 2 colonnes */}
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={(e) => {
          const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
          if (
            contentOffset.y + layoutMeasurement.height > contentSize.height - 600 &&
            visibleCount < filteredDeals.length
          ) {
            setVisibleCount((c) => Math.min(c + 20, filteredDeals.length));
          }
        }}
        contentContainerStyle={{ paddingTop: spacing.md, paddingBottom: 120, paddingHorizontal: spacing.md }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {filteredDeals.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcons name="local-offer" size={64} color={colors.textSecondary} />
            <Text style={styles.emptyTitle}>Aucun rabais disponible</Text>
            {error && <Text style={{ color: 'red', textAlign: 'center', padding: 16 }}>{error}</Text>}
          </View>
        ) : (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1, gap: 8 }}>
              {visibleDeals.filter((_, i) => i % 2 === 0).map((deal) => (
                <DealCard
                  key={deal.id}
                  deal={deal}
                  aspectRatio={[4 / 3, 1, 5 / 4][parseInt(deal.id.replace(/\D/g, '').slice(-1) || '0', 10) % 3]}
                />
              ))}
            </View>
            <View style={{ flex: 1, gap: 8 }}>
              {visibleDeals.filter((_, i) => i % 2 === 1).map((deal) => (
                <DealCard
                  key={deal.id}
                  deal={deal}
                  aspectRatio={[1, 5 / 4, 4 / 3][parseInt(deal.id.replace(/\D/g, '').slice(-1) || '0', 10) % 3]}
                />
              ))}
            </View>
          </View>
        )}
      </Animated.ScrollView>

      {/* Modal Filtres */}
      <Modal visible={showFilters} animationType="slide" transparent onRequestClose={() => setShowFilters(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filtres</Text>
              <View style={styles.modalHeaderRight}>
                {activeFiltersCount > 0 && (
                  <Pressable onPress={resetFilters} style={styles.resetButton}>
                    <Text style={styles.resetText}>Réinitialiser</Text>
                  </Pressable>
                )}
                <Pressable onPress={() => setShowFilters(false)}>
                  <MaterialIcons name="close" size={24} color={colors.text} />
                </Pressable>
              </View>
            </View>

            <ScrollView contentContainerStyle={styles.modalContent}>
              {/* Catégories */}
              <Text style={[styles.filterSectionTitle, { marginTop: 0 }]}>Type d'aliment</Text>
              <View style={styles.chipRow}>
                {CATEGORIES.map(c => (
                  <Pressable
                    key={c.key}
                    style={[styles.chip, selectedCategory === c.key && styles.chipActive]}
                    onPress={() => setSelectedCategory(c.key)}
                  >
                    <Text style={[styles.chipText, selectedCategory === c.key && styles.chipTextActive]}>{c.label}</Text>
                  </Pressable>
                ))}
              </View>

              {/* Rabais */}
              <Text style={styles.filterSectionTitle}>% de rabais</Text>
              <View style={styles.chipRow}>
                {DISCOUNT_RANGES.map(d => (
                  <Pressable
                    key={d.key}
                    style={[styles.chip, selectedDiscount === d.key && styles.chipActive]}
                    onPress={() => setSelectedDiscount(d.key)}
                  >
                    <Text style={[styles.chipText, selectedDiscount === d.key && styles.chipTextActive]}>{d.label}</Text>
                  </Pressable>
                ))}
              </View>

              {/* Prix */}
              <Text style={styles.filterSectionTitle}>Prix maximum</Text>
              <View style={styles.chipRow}>
                {PRICE_RANGES.map(p => (
                  <Pressable
                    key={p.key}
                    style={[styles.chip, selectedPrice === p.key && styles.chipActive]}
                    onPress={() => setSelectedPrice(p.key)}
                  >
                    <Text style={[styles.chipText, selectedPrice === p.key && styles.chipTextActive]}>{p.label}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>

            <Pressable style={styles.applyButton} onPress={() => setShowFilters(false)}>
              <Text style={styles.applyButtonText}>
                Voir {filteredDeals.length} résultat{filteredDeals.length !== 1 ? 's' : ''}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { justifyContent: 'center', alignItems: 'center' },
  header: {
    backgroundColor: colors.darkBeige,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomLeftRadius: borderRadius.xl,
    borderBottomRightRadius: borderRadius.xl,
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md },
  title: { color: colors.text, fontFamily: 'InstrumentSerif_400Regular', fontSize: 32, fontWeight: '400', letterSpacing: -0.5, lineHeight: 32 },
  dealsCount: { fontSize: 13, fontWeight: '500', color: colors.textSecondary, marginTop: 2 },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
    backgroundColor: 'transparent',
  },
  filterBadge: {
    minWidth: 18, height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: { fontSize: 10, fontWeight: '700', color: '#fff' },
  storeTabsScroll: { marginTop: spacing.md, marginHorizontal: -spacing.lg },
  storeTabsContent: { paddingHorizontal: spacing.lg, gap: 8 },
  storeTab: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  storeTabActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  storeTabText: { fontSize: 13, fontWeight: '500', color: colors.textSecondary },
  storeTabTextActive: { color: '#fff', fontWeight: '600' },
  loadingText: { ...typography.body, color: colors.textSecondary, marginTop: spacing.md },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xl * 2 },
  emptyTitle: { ...typography.h2, color: colors.text, marginTop: spacing.md },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContainer: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle: { ...typography.h2, color: colors.text },
  modalHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  resetButton: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  resetText: { ...typography.body, color: colors.primary },
  modalContent: { padding: spacing.lg, paddingBottom: spacing.xl },
  filterSectionTitle: { ...typography.bodyBold, color: colors.text, marginBottom: spacing.sm, marginTop: spacing.lg },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { paddingHorizontal: 11, paddingVertical: 5, borderRadius: 6, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { fontSize: 12, color: colors.textSecondary, fontWeight: '500' },
  chipTextActive: { color: '#fff' },
  applyButton: { margin: spacing.lg, backgroundColor: colors.accent, borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  applyButtonText: { ...typography.bodyBold, color: '#fff', fontSize: 14 },
});
