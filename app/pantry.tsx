import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import { usePantry } from '@/hooks/usePantry';
import { pantryService } from '@/services/pantryService';

export default function PantryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { items: pantryItems, loading: pantryLoading, addItem, removeItem } = usePantry();
  
  const [allIngredients, setAllIngredients] = useState<{ id: string; name: string; category?: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadIngredients();
  }, []);

  const loadIngredients = async () => {
    setLoading(true);
    const ingredients = await pantryService.getAllRecipeIngredients();
    setAllIngredients(ingredients);
    setLoading(false);
  };

  // Filtrer les ingrédients par recherche
  const filteredIngredients = searchQuery.trim()
    ? allIngredients.filter(ing =>
        ing.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
      )
    : allIngredients;

  const handleToggleIngredient = async (ingredient: { id: string; name: string }) => {
  const existing = pantryItems?.find(p => p.name === ingredient.name);
  if (existing) {
    await removeItem(existing.id);
  } else {
    await addItem({ name: ingredient.name });
  }
};

  const handleClearAll = async () => {
    await clearAll();
  };

  const renderIngredient = ({ item }: { item: { id: string; name: string; category?: string } }) => {
    const inPantry = pantryItems?.some(p => p.name === item.name)
;

    return (
      <Pressable
        style={({ pressed }) => [
          styles.ingredientRow,
          pressed && { backgroundColor: colors.surfaceLight },
        ]}
        onPress={() => handleToggleIngredient(item)}
      >
        <View style={styles.ingredientLeft}>
          <View style={[
            styles.checkbox,
            inPantry && styles.checkboxActive,
          ]}>
            {inPantry && (
              <MaterialIcons name="check" size={20} color={colors.surface} />
            )}
          </View>
          <Text style={[
            styles.ingredientName,
            inPantry && styles.ingredientNameChecked,
          ]}>
            {item.name}
          </Text>
        </View>
      </Pressable>
    );
  };

  if (loading || pantryLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Chargement...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
        >
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Mon garde-manger</Text>
        {pantryItems.length > 0 && (
          <Pressable
            onPress={handleClearAll}
            hitSlop={12}
          >
            <Text style={styles.clearAllText}>Effacer</Text>
          </Pressable>
        )}
        {pantryItems.length === 0 && <View style={{ width: 24 }} />}
      </View>

      {/* Stats */}
      <View style={styles.stats}>
        <Text style={styles.statsText}>
          {pantryItems.length} ingrédient{pantryItems.length > 1 ? 's' : ''} dans le garde-manger
        </Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <MaterialIcons name="search" size={20} color={colors.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher un ingrédient..."
          placeholderTextColor={colors.textLight}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
            <MaterialIcons name="close" size={20} color={colors.textSecondary} />
          </Pressable>
        )}
      </View>

      {/* Ingredients List */}
      <FlatList
        data={filteredIngredients}
        keyExtractor={(item) => item.id}
        renderItem={renderIngredient}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialIcons name="search-off" size={64} color={colors.border} />
            <Text style={styles.emptyText}>Aucun ingrédient trouvé</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.darkBeige,
    borderBottomLeftRadius: borderRadius.xl,
    borderBottomRightRadius: borderRadius.xl,
  },
  headerTitle: {
    ...typography.h2,
    color: colors.text,
  },
  clearAllText: {
    ...typography.bodyBold,
    color: colors.error,
    fontSize: 14,
  },
  stats: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  statsText: {
    ...typography.bodyBold,
    color: colors.textSecondary,
    fontSize: 14,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    marginHorizontal: spacing.lg,
    marginVertical: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    paddingVertical: spacing.xs,
  },
  listContent: {
    paddingBottom: spacing.xxl,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  ingredientLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.sm,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  ingredientName: {
    ...typography.body,
    color: colors.text,
    flex: 1,
  },
  ingredientNameChecked: {
    color: colors.textSecondary,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl * 2,
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  loadingText: {
    ...typography.body,
    color: colors.textSecondary,
  },
});
