import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { Deal } from '@/types';
import { colors, spacing, borderRadius, storeInfo } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';
import { useShoppingList } from '@/hooks/useShoppingList';

interface DealCardProps {
  deal: Deal;
  style?: any;
  aspectRatio?: number;
}

function DealCardInner({ deal, style, aspectRatio = 4 / 3 }: DealCardProps) {
  const store = storeInfo[deal.store_code] || { name: deal.store_code?.toUpperCase(), color: colors.textLight };
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
      <View style={[styles.thumb, { aspectRatio }]}>
        {deal.image_url ? (
          <Image
            source={{ uri: deal.image_url }}
            style={styles.image}
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
            recyclingKey={deal.id}
          />
        ) : (
          <MaterialIcons name="local-offer" size={28} color={colors.textLight} />
        )}
      </View>

      {discountPct && discountPct > 0 ? (
        <View style={styles.discountPill}>
          <Text style={styles.discountText}>−{discountPct}%</Text>
        </View>
      ) : null}

      <Text style={styles.productName} numberOfLines={2}>{deal.product_name}</Text>
      <Text style={[styles.storeName, { color: store.color }]} numberOfLines={1}>
        {store.name}
      </Text>

      <View style={styles.priceRow}>
        <View style={styles.prices}>
          <Text style={styles.salePrice}>
            {(deal.sale_price || deal.original_price || 0).toFixed(2)}$
          </Text>
          {deal.original_price && deal.sale_price && deal.original_price > deal.sale_price && (
            <Text style={styles.originalPrice}>{deal.original_price.toFixed(2)}$</Text>
          )}
        </View>
        <Pressable
          onPress={handleToggleList}
          style={[styles.addButton, isInList && styles.addButtonActive]}
        >
          <MaterialIcons
            name={isInList ? 'check' : 'add'}
            size={20}
            color={isInList ? '#fff' : colors.accent}
          />
        </Pressable>
      </View>
    </View>
  );
}

export const DealCard = React.memo(DealCardInner, (prev, next) =>
  prev.deal.id === next.deal.id &&
  prev.aspectRatio === next.aspectRatio &&
  prev.deal.sale_price === next.deal.sale_price
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  thumb: {
    width: '100%',
    backgroundColor: colors.background,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: 2,
  },
  image: { width: '100%', height: '100%' },
  discountPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#FDE8E5',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  discountText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent,
  },
  productName: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text,
    lineHeight: 20,
  },
  storeName: {
    fontSize: 13,
    fontWeight: '600',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 'auto',
  },
  prices: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 9,
    flex: 1,
  },
  salePrice: {
    fontSize: 24,
    fontWeight: '600',
    fontFamily: 'InstrumentSerif_400Regular',
    color: colors.accent,
  },
  originalPrice: {
    fontSize: 14,
    color: colors.textLight,
    textDecorationLine: 'line-through',
  },
  addButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: colors.accent,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
});
