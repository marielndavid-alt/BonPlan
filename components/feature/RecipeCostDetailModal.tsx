import React, { useEffect, useState } from 'react';
import { Modal, View, Text, Pressable, ActivityIndicator, StyleSheet, FlatList } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { colors, spacing, typography, borderRadius, storeInfo } from '@/constants/theme';

interface RecipeCostDetailModalProps {
  visible: boolean;
  recipeId: string | null;
  recipeName: string;
  onClose: () => void;
}

const STORES = ['metro', 'iga', 'superc', 'maxi', 'walmart'];

export function RecipeCostDetailModal({ visible, recipeId, recipeName, onClose }: RecipeCostDetailModalProps) {
  const [storePrices, setStorePrices] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && recipeId) loadStorePrices();
  }, [visible, recipeId]);

  const loadStorePrices = async () => {
    if (!recipeId) return;
    setLoading(true);
    try {
      // Charger le garde-manger du user
      const { data: { user } } = await supabase.auth.getUser();
      const { data: pantry } = await supabase
        .from('pantry_items')
        .select('name')
        .eq('user_id', user?.id);
      const pantryNames = (pantry || []).map((p: any) => p.name.toLowerCase());

      // Charger les ingrédients de la recette
      const { data: recipeIngs } = await supabase
        .from('recipe_ingredients')
        .select('id, products(name)')
        .eq('recipe_id', recipeId);

      // Identifier les ingredient IDs qui sont dans le garde-manger
      const pantryIngredientIds = new Set(
        (recipeIngs || [])
          .filter((ri: any) => {
            const name = ri.products?.name?.toLowerCase() || '';
            return pantryNames.some(pn => name.includes(pn) || pn.includes(name));
          })
          .map((ri: any) => ri.id)
      );

      // Charger les prix par ingrédient par épicerie
      const { data: ingPrices } = await supabase
        .from('recipe_ingredient_prices')
        .select('recipe_ingredient_id, store_id, cost, stores(code)')
        .eq('recipe_id', recipeId);

      // Charger les totaux par épicerie
      const { data: storeTotals } = await supabase
        .from('recipe_store_prices')
        .select('total_price, ingredients_covered, ingredients_total, store_id, stores(code, name, color)')
        .eq('recipe_id', recipeId);

      // Calculer le prix ajusté (sans les ingrédients du garde-manger)
      const adjusted = (storeTotals || []).map((sp: any) => {
        const storeIngPrices = (ingPrices || []).filter((ip: any) => ip.store_id === sp.store_id);
        
        // Coût des ingrédients dans le garde-manger pour cette épicerie
        const pantrySavings = storeIngPrices
          .filter((ip: any) => pantryIngredientIds.has(ip.recipe_ingredient_id))
          .reduce((sum: number, ip: any) => sum + (ip.cost || 0), 0);

        // Ingrédients manquants couverts par le garde-manger
        const missingCoveredByPantry = (recipeIngs || [])
          .filter((ri: any) => {
            const name = ri.products?.name?.toLowerCase() || '';
            const isInPantry = pantryNames.some(pn => name.includes(pn) || pn.includes(name));
            const hasPrice = storeIngPrices.some((ip: any) => ip.recipe_ingredient_id === ri.id);
            return isInPantry && !hasPrice;
          }).length;

        const effectiveCovered = sp.ingredients_covered + missingCoveredByPantry;

        return {
          ...sp,
          adjusted_total: Math.max(0, sp.total_price - pantrySavings),
          effective_covered: effectiveCovered,
          pantry_savings: pantrySavings,
        };
      });

      setStorePrices(adjusted);
    } finally {
      setLoading(false);
    }
  };

  const validStores = storePrices.filter((sp: any) => 
    sp.effective_covered >= sp.ingredients_total
  );

  const bestStore = validStores.sort((a, b) => a.adjusted_total - b.adjusted_total)[0];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title} numberOfLines={1}>{recipeName}</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <MaterialIcons name="close" size={24} color={colors.text} />
            </Pressable>
          </View>

          {loading ? (
            <ActivityIndicator style={{ marginVertical: 40 }} color={colors.primary} />
          ) : (
            <FlatList
              data={STORES}
              keyExtractor={item => item}
              contentContainerStyle={styles.content}
              ListHeaderComponent={<Text style={styles.sectionTitle}>Prix par épicerie</Text>}
              renderItem={({ item: storeCode }) => {
                const sp = storePrices.find((s: any) => s.stores?.code === storeCode);
                const info = storeInfo[storeCode];
                const isBest = bestStore && sp?.stores?.code === bestStore.stores?.code;
                const isAvailable = sp && sp.effective_covered >= sp.ingredients_total;

                return (
                  <View style={[styles.storeRow, isBest && styles.storeRowBest]}>
                    <View style={[styles.storeDot, { backgroundColor: info?.color || colors.primary }]} />
                    <View style={styles.storeInfo}>
                      <Text style={styles.storeName}>{info?.name || storeCode}</Text>
                      
                    </View>
                    {isBest && (
                      <View style={styles.bestBadge}>
                        <Text style={styles.bestBadgeText}>Meilleur</Text>
                      </View>
                    )}
                    <Text style={[styles.storePrice, !isAvailable && styles.storePriceNA]}>
                      {isAvailable && sp
                        ? `${sp.adjusted_total.toFixed(2)}$`
                        : 'Non disponible'}
                    </Text>
                  </View>
                );
              }}
            ListFooterComponent={
  storePrices.some((sp: any) => sp.pantry_savings > 0) ? (
    <Text style={styles.pantryNote}>
      * Le prix indiqué prend en compte les ingrédients que vous avez déjà dans votre garde-manger
    </Text>
  ) : null
}/>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  container: { backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '70%' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { ...typography.h3, color: colors.text, flex: 1, marginRight: spacing.md },
  content: { padding: spacing.lg, paddingBottom: 40 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: colors.text, marginBottom: spacing.md },
  storeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  storeRowBest: { backgroundColor: '#F0FFF4', borderRadius: borderRadius.md, paddingHorizontal: spacing.sm },
  storeDot: { width: 12, height: 12, borderRadius: 6 },
  storeInfo: { flex: 1 },
  storeName: { ...typography.body, color: colors.text },
  bestBadge: { backgroundColor: colors.success, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: borderRadius.full },
  bestBadgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  storePrice: { ...typography.bodyBold, color: colors.primary },
  storePriceNA: { color: colors.textSecondary, fontWeight: '400', fontSize: 14 },
});
