import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import { getSupabaseClient } from '@/template';
import { useShoppingList } from '@/hooks/useShoppingList';
import { RecipeCostDetailModal } from '@/components/feature/RecipeCostDetailModal';

interface IngredientSection {
  name: string;
  ingredients: Array<{
    product_id: string;
    product_name: string;
    quantity: number;
    unit: string;
    bestPrice?: { price: number; storeCode: string; storeName: string };
  }>;
}

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { addItem } = useShoppingList();
  const [recipe, setRecipe] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [ingredientSections, setIngredientSections] = useState<IngredientSection[]>([]);
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [recipePrice, setRecipePrice] = useState<number | null>(null);
  const [bestStore, setBestStore] = useState<string | null>(null);
  const [pricePerServing, setPricePerServing] = useState<number | null>(null);
  const [currentServings, setCurrentServings] = useState(4);
  const [rating, setRating] = useState(0);
  const [addedIngredients, setAddedIngredients] = useState<Set<string>>(new Set());

  useEffect(() => { loadRecipe(); }, [id]);
  useEffect(() => { if (recipe) setCurrentServings(recipe.servings); }, [recipe]);

  const loadRecipe = async () => {
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('recipes')
        .select('*, recipe_ingredients(product_id, quantity, unit, section, products(id, name))')
        .eq('id', id)
        .single();
      if (error) throw error;
      setRecipe(data);

      if (data.recipe_ingredients) {
        const productIds = data.recipe_ingredients.map((ri: any) => ri.product_id);
        const [{ data: allPrices }] = await Promise.all([
          supabase
            .from('prices')
            .select('product_id, regular_price, sale_price, is_on_sale, stores(code, name)')
            .in('product_id', productIds)
            .order('regular_price', { ascending: true }),
          loadBestPrice(data.id, data.servings),
        ]);
        const priceMap = new Map();
        for (const p of (allPrices || [])) {
          if (!priceMap.has(p.product_id)) {
            const price = p.is_on_sale && p.sale_price ? Number(p.sale_price) : Number(p.regular_price);
            priceMap.set(p.product_id, { price, storeCode: (p.stores as any).code, storeName: (p.stores as any).name });
          }
        }
        const sectionMap = new Map<string, any[]>();
        data.recipe_ingredients.forEach((ri: any) => {
          const section = ri.section || 'Ingrédients';
          if (!sectionMap.has(section)) sectionMap.set(section, []);
          sectionMap.get(section)!.push({
            product_id: ri.product_id,
            product_name: ri.products.name,
            quantity: ri.quantity,
            unit: ri.unit,
            section,
            bestPrice: priceMap.get(ri.product_id),
          });
        });
        setIngredientSections(Array.from(sectionMap.entries()).map(([name, ingredients]) => ({ name, ingredients })));
      }
    } catch (error) {
      console.error('Error loading recipe:', error);
    } finally {
      setLoading(false);
    }
  };

  const getBestPriceForIngredient = async (productId: string) => {
    try {
      const supabase = getSupabaseClient();
      const { data: prices } = await supabase
        .from('prices')
        .select('regular_price, sale_price, is_on_sale, stores(code, name)')
        .eq('product_id', productId)
        .order('regular_price', { ascending: true });
      if (!prices || prices.length === 0) return undefined;
      const best = prices[0];
      const price = best.is_on_sale && best.sale_price ? Number(best.sale_price) : Number(best.regular_price);
      return { price, storeCode: (best.stores as any).code, storeName: (best.stores as any).name };
    } catch { return undefined; }
  };

  const loadBestPrice = async (recipeId: string, servings: number) => {
    try {
      const supabase = getSupabaseClient();

      const { data: { user } } = await supabase.auth.getUser();

      // Toutes les requêtes en parallèle
      const [
        { data: pantry },
        { data: recipeIngs },
        { data: ingPrices },
        { data: storeTotals },
      ] = await Promise.all([
        supabase.from('pantry_items').select('name').eq('user_id', user?.id),
        supabase.from('recipe_ingredients').select('id, products(name)').eq('recipe_id', recipeId),
        supabase.from('recipe_ingredient_prices').select('recipe_ingredient_id, store_id, cost').eq('recipe_id', recipeId),
        supabase.from('recipe_store_prices').select('total_price, ingredients_covered, ingredients_total, store_id, stores(code)').eq('recipe_id', recipeId).order('total_price', { ascending: true }),
      ]);

      const pantryNames = (pantry || []).map((p: any) => p.name.toLowerCase());

      const pantryIngredientIds = new Set(
        (recipeIngs || [])
          .filter((ri: any) => {
            const name = ri.products?.name?.toLowerCase() || '';
            return pantryNames.some((pn: string) => name.includes(pn) || pn.includes(name));
          })
          .map((ri: any) => ri.id)
      );



      let best: { total: number; storeCode: string } | null = null;

      for (const sp of (storeTotals || [])) {
        const storeIngPrices = (ingPrices || []).filter((ip: any) => ip.store_id === sp.store_id);

        const pantrySavings = storeIngPrices
          .filter((ip: any) => pantryIngredientIds.has(ip.recipe_ingredient_id))
          .reduce((sum: number, ip: any) => sum + (ip.cost || 0), 0);

        const missingCoveredByPantry = (recipeIngs || [])
          .filter((ri: any) => {
            const name = ri.products?.name?.toLowerCase() || '';
            const isInPantry = pantryNames.some((pn: string) => name.includes(pn) || pn.includes(name));
            const hasPrice = storeIngPrices.some((ip: any) => ip.recipe_ingredient_id === ri.id);
            return isInPantry && !hasPrice;
          }).length;

        const effectiveCovered = sp.ingredients_covered + missingCoveredByPantry;
        const adjustedTotal = Math.max(0, sp.total_price - pantrySavings);
console.log('[loadBestPrice] store:', (sp.stores as any)?.code, 'covered:', sp.ingredients_covered, 'pantry:', missingCoveredByPantry, 'effective:', effectiveCovered, 'total:', sp.ingredients_total);

        if (effectiveCovered >= sp.ingredients_total) {
          console.log("[best] store:", (sp.stores as any)?.code, "adjusted:", adjustedTotal, "pantrySavings:", pantrySavings);
        console.log("[best] store:", (sp.stores as any)?.code, "adjusted:", adjustedTotal, "pantrySavings:", pantrySavings);
        if (!best || adjustedTotal < best.total) {
            best = { total: adjustedTotal, storeCode: (sp.stores as any)?.code };
          }
        }
      }

      if (best) {
        setRecipePrice(best.total);
        setBestStore(best.storeCode);
        setPricePerServing(servings > 0 ? best.total / servings : 0);
      }
    } catch (error) {
      console.error('Error loading best price:', error);
    }
  };

  const handleAddIngredient = async (ingredient: IngredientSection['ingredients'][0]) => {
    try {
      await addItem({
        id: `${ingredient.product_id}-${Date.now()}`,
        name: ingredient.product_name,
        quantity: ingredient.quantity.toString(),
        unit: ingredient.unit,
        price: ingredient.bestPrice?.price || 0,
        store: (ingredient.bestPrice?.storeCode as any) || 'N/A',
        checked: false,
      });
      setAddedIngredients(prev => new Set(prev).add(ingredient.product_id));
    } catch (error) {
      console.error('Error adding ingredient:', error);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  if (!recipe) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Recette introuvable</Text>
        </View>
      </View>
    );
  }

  const instructionsArray = Array.isArray(recipe.instructions)
    ? recipe.instructions
    : (recipe.instructions || '').split('\n');
  const validInstructions = instructionsArray.filter((i: string) => i.trim());
  let stepCounter = 0;

  return (
    <View style={styles.container}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        <View style={styles.imageContainer}>
          {recipe.image && recipe.image.startsWith('http') && (
            <Image source={{ uri: recipe.image }} style={styles.recipeImage} contentFit="cover" transition={200} />
          )}
          <View style={[styles.imageOverlay, { paddingTop: insets.top + spacing.md }]}>
            <Pressable onPress={() => router.back()} style={styles.overlayButton}>
              <MaterialIcons name="arrow-back" size={28} color="#FFFFFF" />
            </Pressable>
            <Pressable onPress={() => setRating(rating === 1 ? 0 : 1)} style={styles.overlayButton}>
              <MaterialIcons name={rating > 0 ? "favorite" : "favorite-border"} size={28} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>

        <View style={styles.infoSection}>
          <View style={styles.titleRow}>
            <Text style={styles.recipeTitle}>{recipe.title}</Text>
            <View style={styles.likeBadge}>
              <Text style={styles.likeCount}>{(recipe.likes || 0) + (rating > 0 ? 1 : 0)}</Text>
              <MaterialIcons name="favorite" size={20} color={colors.primary} />
            </View>
          </View>

          {((recipe.diet_tags && recipe.diet_tags.length > 0) || (recipe.tags && recipe.tags.length > 0)) && (
  <View style={styles.tagsRow}>
    {[...(recipe.diet_tags || []), ...(recipe.tags || [])].slice(0, 4).map((tag: string, index: number) => (
      <View key={index} style={styles.tagChip}>
        <Text style={styles.tagText}>{tag}</Text>
      </View>
    ))}
  </View>
)}

          <View style={styles.metaRow}>
            <View style={styles.timeInfo}>
              <MaterialIcons name="schedule" size={24} color={colors.text} />
              <Text style={styles.timeText}>{recipe.prep_time} min</Text>
            </View>
            <View style={styles.servingsSelector}>
              <MaterialIcons name="person" size={24} color={colors.text} />
              <Pressable style={styles.servingButton} onPress={() => setCurrentServings(Math.max(1, currentServings - 1))}>
                <Text style={styles.servingButtonText}>-</Text>
              </Pressable>
              <Text style={styles.servingCount}>{currentServings}</Text>
              <Pressable style={styles.servingButton} onPress={() => setCurrentServings(currentServings + 1)}>
                <Text style={styles.servingButtonText}>+</Text>
              </Pressable>
            </View>
          </View>
        </View>

        <View style={styles.ingredientsSection}>
          <Text style={styles.sectionTitle}>Ingrédients</Text>
          {ingredientSections.map((section, sectionIndex) => (
            <View key={sectionIndex}>
              {ingredientSections.length > 1 && (
                <Text style={styles.ingredientSectionTitle}>{section.name}</Text>
              )}
              {section.ingredients.map((ingredient, index) => {
                const adjustedQuantity = recipe.servings > 0
                  ? (ingredient.quantity * currentServings / recipe.servings).toFixed(1)
                  : ingredient.quantity;
                return (
                  <View key={index} style={styles.ingredientItem}>
                    <View style={styles.ingredientLeft}>
                      <Text style={styles.ingredientName}>{ingredient.product_name}</Text>
                    </View>
                    <View style={styles.ingredientRight}>
                      <Text style={styles.ingredientQuantity}>{adjustedQuantity} {ingredient.unit}</Text>
                      <Pressable
                        style={[styles.addButton, addedIngredients.has(ingredient.product_id) && styles.addButtonChecked]}
                        onPress={() => handleAddIngredient({ ...ingredient, quantity: parseFloat(adjustedQuantity as string) })}
                        disabled={addedIngredients.has(ingredient.product_id)}
                      >
                        <MaterialIcons
                          name={addedIngredients.has(ingredient.product_id) ? "check" : "add"}
                          size={20}
                          color={addedIngredients.has(ingredient.product_id) ? "#FFFFFF" : colors.primary}
                        />
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
          ))}
        </View>

        <View style={styles.instructionsSection}>
          <Text style={styles.modeEmploiTitle}>Mode d'emploi</Text>
          {validInstructions.map((instruction: string, index: number) => {
            if (instruction.trim().startsWith('##')) {
              const sectionTitle = instruction.replace(/^##\s*/, '').trim();
              return (
                <View key={index} style={styles.instructionSectionHeader}>
                  <Text style={styles.instructionSectionTitle}>{sectionTitle}</Text>
                </View>
              );
            }
            stepCounter++;
            return (
              <View key={index} style={styles.instructionItem}>
                <View style={styles.instructionNumber}>
                  <Text style={styles.instructionNumberText}>{stepCounter}</Text>
                </View>
                <Text style={styles.instructionText}>{instruction}</Text>
              </View>
            );
          })}
        </View>

        {recipe.equipment && recipe.equipment.length > 0 && (
          <View style={styles.equipmentSection}>
            <Text style={styles.equipmentTitle}>Équipement nécessaire</Text>
            {recipe.equipment.map((item: string, index: number) => (
              <View key={index} style={styles.equipmentItem}>
                <MaterialIcons name="kitchen" size={20} color={colors.primary} />
                <Text style={styles.equipmentText}>{item}</Text>
              </View>
            ))}
          </View>
        )}

        {recipePrice !== null && bestStore && (
          <Pressable style={styles.costBox} onPress={() => setShowPriceModal(true)}>
            <View style={styles.costHeader}>
              <Text style={styles.costTitle}>Option la moins chère:</Text>
              <View style={styles.storeBadge}>
                <Text style={styles.storeBadgeText}>{bestStore.toUpperCase()}</Text>
              </View>
            </View>
            <View style={styles.costItem}>
              <Text style={styles.costLabel}>Coût total estimé:</Text>
              <Text style={styles.costAmount}>{recipePrice.toFixed(2)}$</Text>
            </View>
            {pricePerServing !== null && (
              <View style={styles.costItem}>
                <Text style={styles.costLabel}>Coût par portion:</Text>
                <Text style={styles.costAmount}>{pricePerServing.toFixed(2)}$</Text>
              </View>
            )}
            <View style={styles.seeDetailsButton}>
              <Text style={styles.seeDetailsText}>Voir détails</Text>
              <MaterialIcons name="arrow-forward" size={16} color={colors.primary} />
            </View>
          </Pressable>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      <RecipeCostDetailModal currentServings={currentServings} baseServings={recipe.servings}
        visible={showPriceModal}
        recipeId={recipe.id}
        recipeName={recipe.title}
        onClose={() => setShowPriceModal(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.beige },
  scrollContent: { backgroundColor: colors.beige },
  content: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  errorText: { ...typography.h3, color: colors.textSecondary },
  imageContainer: { position: 'relative', width: '100%', height: 400, borderBottomLeftRadius: 16, borderBottomRightRadius: 16, overflow: 'hidden' },
  recipeImage: { width: '100%', height: '100%' },
  imageOverlay: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.lg },
  overlayButton: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center' },
  infoSection: { padding: spacing.xl, backgroundColor: colors.beige },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.md },
  recipeTitle: { fontSize: 40, fontFamily: 'serif', color: colors.text, flex: 1, paddingRight: spacing.md, lineHeight: 48 },
  likeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  likeCount: { fontSize: 18, fontWeight: '600', color: colors.text },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  tagChip: { paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: borderRadius.full, borderWidth: 2, borderColor: colors.primary, backgroundColor: 'transparent' },
  tagText: { fontSize: 14, color: colors.primary, fontWeight: '500' },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  timeInfo: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  timeText: { fontSize: 18, color: colors.text },
  servingsSelector: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  servingButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  servingButtonText: { fontSize: 28, color: colors.text, fontWeight: '300' },
  servingCount: { fontSize: 20, color: colors.text, fontWeight: '500', minWidth: 30, textAlign: 'center' },
  ingredientsSection: { backgroundColor: colors.beige, paddingHorizontal: spacing.xl, paddingVertical: spacing.lg },
  sectionTitle: { fontSize: 24, fontFamily: 'serif', color: colors.primary, marginBottom: 8, fontWeight: '600', borderBottomWidth: 2, borderBottomColor: colors.primary, paddingBottom: 8 },
  ingredientSectionTitle: { fontSize: 18, color: colors.primary, fontWeight: '600', marginTop: spacing.lg, marginBottom: spacing.md },
  ingredientItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: '#D4C7BA' },
  ingredientLeft: { flex: 1 },
  ingredientName: { fontSize: 18, color: colors.text, marginBottom: 4 },
  ingredientRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  ingredientQuantity: { fontSize: 16, color: colors.text, minWidth: 60, textAlign: 'right' },
  addButton: { width: 39, height: 39, borderRadius: 20, borderWidth: 2, borderColor: colors.primary, backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  addButtonChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  instructionsSection: { backgroundColor: colors.beige, padding: spacing.lg, marginTop: spacing.sm },
  modeEmploiTitle: { fontSize: 24, fontFamily: 'serif', color: colors.primary, marginBottom: spacing.lg, fontWeight: '600', borderBottomWidth: 2, borderBottomColor: colors.primary, paddingBottom: 8 },
  instructionSectionHeader: { marginTop: spacing.md, marginBottom: spacing.sm, paddingBottom: spacing.sm },
  instructionSectionTitle: { ...typography.h3, color: colors.primary, fontSize: 18, fontWeight: '700' },
  instructionItem: { flexDirection: 'row', marginBottom: spacing.md, gap: spacing.md },
  instructionNumber: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  instructionNumberText: { ...typography.bodyBold, color: colors.surface },
  instructionText: { ...typography.body, color: colors.text, flex: 1, lineHeight: 24 },
  equipmentSection: { padding: spacing.lg, backgroundColor: colors.beige, marginTop: spacing.sm },
  equipmentTitle: { fontSize: 24, fontFamily: 'serif', color: colors.primary, marginBottom: 8, fontWeight: '600', borderBottomWidth: 2, borderBottomColor: colors.primary, paddingBottom: 8 },
  equipmentItem: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm, gap: spacing.sm },
  equipmentText: { ...typography.body, color: colors.text },
  costBox: { backgroundColor: '#E8D9FF', marginHorizontal: spacing.xl, marginTop: spacing.lg, marginBottom: spacing.lg, paddingHorizontal: spacing.xl, paddingVertical: spacing.lg, borderRadius: borderRadius.xl },
  costHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  costTitle: { fontSize: 16, color: colors.text, fontWeight: '500' },
  storeBadge: { backgroundColor: 'transparent', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: borderRadius.full, borderWidth: 2, borderColor: colors.primary },
  storeBadgeText: { fontSize: 14, color: colors.primary, fontWeight: '600' },
  costItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
  costLabel: { fontSize: 16, color: colors.text },
  costAmount: { fontSize: 20, color: colors.text, fontWeight: '600' },
  seeDetailsButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.1)', gap: spacing.xs },
  seeDetailsText: { fontSize: 14, color: colors.primary, fontWeight: '600' },
});