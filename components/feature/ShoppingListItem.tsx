import React from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, storeInfo } from '@/constants/theme';
import { ShoppingListItem as ShoppingListItemType } from '@/types';

interface ShoppingListItemProps {
  item: ShoppingListItemType;
  onToggleCheck: () => void;
  onRemove: () => void;
  onPress: () => void;
}

export function ShoppingListItem({ item, onToggleCheck, onRemove, onPress }: ShoppingListItemProps) {
  const store = item.store && item.store !== 'pantry' ? storeInfo[item.store] : null;
  const brand = (item as any).brand;

  return (
    <Swipeable
      renderRightActions={() => (
        <View style={styles.deleteAction}>
          <MaterialIcons name="delete" size={24} color="#fff" />
          <Text style={styles.deleteText}>Supprimer</Text>
        </View>
      )}
      onSwipeableRightOpen={onRemove}
      rightThreshold={40}
      friction={2}
    >
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.container, pressed && { opacity: 0.85 }]}
      >
        {item.photo && <Image source={{ uri: item.photo }} style={styles.photo} />}

        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, item.checked && styles.nameChecked]} numberOfLines={1}>
              {item.name}
            </Text>
            {store && (
              <View style={[styles.storeBadge, { backgroundColor: store.color }]}>
                <Text style={styles.storeBadgeText}>{store.name}</Text>
              </View>
            )}
          </View>
          {brand && <Text style={styles.brand} numberOfLines={1}>{brand}</Text>}
          {item.note && <Text style={styles.note} numberOfLines={1}>{item.note}</Text>}
        </View>

        <Text style={styles.quantityBadge}>{item.quantity} {item.unit}</Text>

        <Pressable onPress={onToggleCheck} style={styles.checkboxContainer} hitSlop={8}>
          <View style={[styles.checkbox, item.checked && styles.checkboxChecked]}>
            {item.checked && <MaterialIcons name="check" size={16} color="#fff" />}
          </View>
        </Pressable>
      </Pressable>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  deleteAction: {
    backgroundColor: colors.error,
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
  },
  deleteText: { color: '#fff', fontSize: 12, fontWeight: '700', marginTop: 4 },
  photo: { width: 48, height: 48, borderRadius: borderRadius.md },
  info: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  name: { ...typography.bodyBold, color: colors.text },
  nameChecked: { color: colors.textLight, textDecorationLine: 'line-through' },
  brand: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  note: { ...typography.small, color: colors.textSecondary, marginTop: 2 },
  quantityBadge: { ...typography.caption, color: colors.textSecondary },
  storeBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
  },
  storeBadgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  checkboxContainer: { padding: 2 },
  checkbox: {
    width: 26, height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: { backgroundColor: colors.success, borderColor: colors.success },
});