import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';

interface CategoryFilterBarProps {
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
}

const CATEGORIES = [
  { key: 'all', label: 'Tout', icon: 'apps' },
  { key: 'meat', label: 'Viandes', icon: 'restaurant' },
  { key: 'fish', label: 'Poissons', icon: 'set-meal' },
  { key: 'produce-vegetables', label: 'Légumes', icon: 'eco' },
  { key: 'produce-fruits', label: 'Fruits', icon: 'emoji-food-beverage' },
  { key: 'dairy', label: 'Laitiers', icon: 'local-drink' },
  { key: 'pantry', label: 'Épicerie', icon: 'kitchen' },
];

export function CategoryFilterBar({ selectedCategory, onSelectCategory }: CategoryFilterBarProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {CATEGORIES.map(cat => {
        const isActive = selectedCategory === cat.key;
        return (
          <Pressable
            key={cat.key}
            style={[styles.chip, isActive && styles.chipActive]}
            onPress={() => onSelectCategory(cat.key)}
          >
            <MaterialIcons
              name={cat.icon as any}
              size={16}
              color={isActive ? '#fff' : colors.textSecondary}
            />
            <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
              {cat.label}
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    ...typography.captionBold,
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: '#fff',
  },
});
