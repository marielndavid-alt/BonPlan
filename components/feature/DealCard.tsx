import React from 'react';
import { View, Text, StyleSheet, Image, Pressable } from 'react-native';
import { Deal } from '@/types';
import { colors, spacing, typography, borderRadius, shadows, storeInfo } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';
import { useShoppingList } from '@/hooks/useShoppingList';

interface DealCardProps {
  deal: Deal;
  style?: any;
}

export function DealCard({ deal, style }: DealCardProps) {
  const store = storeInfo[deal.store_code] || { name: deal.store_code?.toUpperCase(), color: colors.primary };
  const { addItem, items, removeItem } = useShoppingList();

  const discountPct = deal.discount_percentage
    ? Math.round(deal.discount_percentage)
    : deal.original_price && deal.sale_price
    ? Math.round(((deal.original_price - deal.sale_price) / deal.original_price) * 100)
    : null;

  const isInList = items.some(i => i.name === deal.product_name);

  const handleToggleList = async () => {
    if (isInList) {
      const item = items.find(i => i.name === deal.product_name);
      if (item) removeItem(item.id);
    } else {
      await addItem({
        id: `deal-${deal.id}-${Date.now()}`,
        name: deal.product_name,
        quantity: '1',
        unit: deal.unit || 'unité',
        price: deal.sale_price || deal.original_price || 0,
        store: deal.store_code || '',
        checked: false,
        category: 'pantry',
      }, []);
    }
  };

  return (
    <View style={[styles.card, style]}>
      <View style={[styles.storeBadge, { backgroundColor: store.color }]}>
        <Text style={styles.storeBadgeText}>{store.name}</Text>
      </View>
      {discountPct && discountPct > 0 && (
        <View style={styles.discountBadge}>
          <Text style={styles.discountBadgeText}>-{discountPct}%</Text>
        </View>
      )}
      <View style={styles.imageContainer}>
        {deal.image_url ? (
          <Image source={{ uri: deal.image_url }} style={styles.image} resizeMode="contain" />
        ) : (
          <View style={styles.imagePlaceholder}>
            <MaterialIcons name="local-offer" size={32} color={colors.border} />
          </View>
        )}
      </View>
      <View style={styles.info}>
  <Text style={styles.productName} numberOfLines={2}>{deal.product_name}</Text>
  {deal.unit && <Text style={styles.unit}>{deal.unit}</Text>}
  <View style={styles.priceRow}>
    <View style={styles.prices}>
      {deal.original_price && deal.sale_price && (
        <Text style={styles.originalPrice}>{deal.original_price.toFixed(2)}$</Text>
      )}
      <Text style={styles.salePrice}>
        {(deal.sale_price || deal.original_price || 0).toFixed(2)}$
      </Text>
    </View>
    <Pressable onPress={handleToggleList} style={[styles.addButton, isInList && styles.addButtonActive]}>
      <MaterialIcons name={isInList ? 'check' : 'add'} size={22} color={isInList ? colors.surface : colors.primary} />
    </Pressable>
  </View>
</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: borderRadius.lg, marginBottom: spacing.md, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, ...shadows.sm },
  storeBadge: { position: 'absolute', top: spacing.sm, left: spacing.sm, paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: borderRadius.sm, zIndex: 1 },
  storeBadgeText: { fontSize: 10, fontWeight: '700', color: '#fff' },
  discountBadge: { position: 'absolute', top: spacing.sm, right: spacing.sm, backgroundColor: colors.error, paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: borderRadius.sm, zIndex: 1 },
  discountBadgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  imageContainer: { width: '100%', height: 130, backgroundColor: colors.surface },
  image: { width: '100%', height: '100%' },
  imagePlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  info: { padding: spacing.md },
  productName: { ...typography.bodyBold, color: colors.text, marginBottom: spacing.xs },
  unit: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.xs },
  priceRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: spacing.xs },
prices: { flex: 1 },
originalPrice: { ...typography.caption, color: colors.textLight, textDecorationLine: 'line-through' },
salePrice: { fontSize: 20, fontWeight: '700', color: colors.primary },
addButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
addButtonActive: { backgroundColor: '#FFD4CC', borderColor: colors.primary },
  addButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  addButtonActive: { backgroundColor: colors.primary, borderColor: colors.primary },
});
