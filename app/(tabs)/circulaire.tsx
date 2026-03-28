import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator,
  RefreshControl, Pressable, Modal, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, storeInfo } from '@/constants/theme';
import { circularService, Deal } from '@/services/circularService';
import { DealCard } from '@/components/feature/DealCard';

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
  { key: 'fish', label: 'Poissons' },
  { key: 'produce-vegetables', label: 'Légumes' },
  { key: 'produce-fruits', label: 'Fruits' },
  { key: 'dairy', label: 'Produits laitiers' },
  { key: 'pantry', label: 'Garde-Manger' },
  { key: 'frozen', label: 'Produits congelés' },
];

const DISCOUNT_RANGES = [
  { key: 'all', label: 'Tous les rabais' },
  { key: '10', label: '10% et +' },
  { key: '20', label: '20% et +' },
  { key: '30', label: '30% et +' },
  { key: '50', label: '50% et +' },
];

const PRICE_RANGES = [
  { key: 'all', label: 'Tous les prix' },
  { key: '5', label: 'Moins de 5$' },
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
    selectedStore !== 'all',
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
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Chargement des rabais...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.title}>Circulaire</Text>
            <Text style={styles.subtitle}>Les meilleurs rabais de la semaine</Text>
          </View>
          <Pressable style={styles.filterButton} onPress={() => setShowFilters(true)}>
  <MaterialIcons name="tune" size={22} color="#fff" />
            {activeFiltersCount > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFiltersCount}</Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>

      {/* Liste */}
      <FlatList
        data={filteredDeals}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={{ gap: 8, paddingHorizontal: spacing.md }}
        renderItem={({ item }) => <DealCard deal={item} style={{ flex: 1 }} />}
        contentContainerStyle={{ paddingTop: spacing.md, paddingBottom: 100 }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialIcons name="local-offer" size={64} color={colors.textSecondary} />
            <Text style={styles.emptyTitle}>Aucun rabais disponible</Text>
            {error && <Text style={{ color: 'red', textAlign: 'center', padding: 16 }}>{error}</Text>}
          </View>
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      />

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
              {/* Épiceries */}
              <Text style={styles.filterSectionTitle}>Épicerie</Text>
              <View style={styles.chipRow}>
                {STORES.map(s => (
                  <Pressable
                    key={s.code}
                    style={[styles.chip, selectedStore === s.code && styles.chipActive]}
                    onPress={() => setSelectedStore(s.code)}
                  >
                    <Text style={[styles.chipText, selectedStore === s.code && styles.chipTextActive]}>{s.name}</Text>
                  </Pressable>
                ))}
              </View>

              {/* Catégories */}
              <Text style={styles.filterSectionTitle}>Type d'aliment</Text>
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
  filterButtonActive: { // unused
  backgroundColor: '#9B59B6',
},
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  title: { ...typography.h1, color: colors.text, marginBottom: spacing.xs },
  subtitle: { ...typography.body, color: colors.textSecondary },
  filterButton: {
    width: 44, height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadge: {
    position: 'absolute', top: -4, right: -4,
    width: 18, height: 18,
    borderRadius: 9,
    backgroundColor: '#d4b5ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: { fontSize: 10, fontWeight: '700', color: '#fff' },
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
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.full, backgroundColor: colors.background, borderWidth: 1.5, borderColor: colors.border },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...typography.caption, color: colors.text, fontWeight: '500' },
  chipTextActive: { color: '#fff' },
  applyButton: { margin: spacing.lg, backgroundColor: colors.primary, borderRadius: borderRadius.full, paddingVertical: spacing.md, alignItems: 'center' },
  applyButtonText: { ...typography.bodyBold, color: '#fff', fontSize: 16 },
});
