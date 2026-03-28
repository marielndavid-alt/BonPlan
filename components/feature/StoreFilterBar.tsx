import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { colors, spacing, typography, borderRadius, storeInfo } from '@/constants/theme';

interface StoreFilterBarProps {
  selectedStore: string;
  onSelectStore: (store: string) => void;
}

const STORES = ['all', 'metro', 'iga', 'superc', 'maxi', 'walmart'];

export function StoreFilterBar({ selectedStore, onSelectStore }: StoreFilterBarProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ 
  flexDirection: 'row', 
  gap: spacing.xs, 
  paddingVertical: spacing.xs,
  paddingHorizontal: spacing.lg,
}}
    >
      {STORES.map(store => {
        const isActive = selectedStore === store;
        const info = storeInfo[store];
        const label = store === 'all' ? 'Tous' : info?.name || store.toUpperCase();
        const color = store === 'all' ? colors.primary : info?.color || colors.primary;

        return (
          <Pressable
            key={store}
            style={[styles.chip, isActive && { backgroundColor: color, borderColor: color }]}
            onPress={() => onSelectStore(store)}
          >
            <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  chip: {
  paddingHorizontal: spacing.sm,
  paddingVertical: 4,
  borderRadius: borderRadius.full,
  backgroundColor: colors.surface,
  borderWidth: 1.5,
  borderColor: colors.border,
},
  chipText: {
    ...typography.captionBold,
      fontSize: 12,
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: '#fff',
  },
});

