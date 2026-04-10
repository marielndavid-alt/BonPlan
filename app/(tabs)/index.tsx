import React, { useState, useEffect } from 'react';
import {
  Modal, View, Text, StyleSheet, Pressable, ActivityIndicator,
  ScrollView, Linking, Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFonts, InstrumentSerif_400Regular } from '@expo-google-fonts/instrument-serif';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import { useOptimizedRecipes } from '@/hooks/useOptimizedRecipes';
import { storePreferencesService } from '@/services/storePreferencesService';
import { useAuth, getSupabaseClient } from '@/template';
import { useSubscription } from '@/hooks/useSubscription';
import { useWeeklyMenu } from '@/hooks/useWeeklyMenu';
import { useAlert } from '@/template';

export default function RecipesHomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  useFonts({ InstrumentSerif_400Regular });
  const { user } = useAuth();
  const { isSubscribed, isTrial } = useSubscription();
  const { menuItems, addMenuItem, removeMenuItem } = useWeeklyMenu();
  const { showAlert } = useAlert();
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  
  const portions = 1;
  const [selectedStores, setSelectedStores] = useState<string[]>([]);
  const [cheapestStore, setCheapestStore] = useState<string>('metro');
  const [userStores, setUserStores] = useState<string[]>([]);
  const [showAllStores, setShowAllStores] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'deals'>('deals');
  const [filterStore, setFilterStore] = useState<string[]>([]);
  const [filterMealType, setFilterMealType] = useState<'all' | 'main' | 'snack'>('all');
  const [filterDiet, setFilterDiet] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  
  const { recipes: mainRecipes, loading: loadingMain } = useOptimizedRecipes({
    category: (activeTab === 'all' && filterMealType === 'snack') ? undefined : 'main',
    userStores: activeTab === 'all' ? (filterStore.length > 0 ? filterStore : undefined) : (showAllStores ? undefined : selectedStores),
    limitByStore: activeTab === 'deals' && !showAllStores && selectedStores.length === 1,
    dietTags: activeTab === 'all' && filterDiet.length > 0 ? filterDiet : undefined,
  });

  const { recipes: snackRecipes, loading: loadingSnacks } = useOptimizedRecipes({
    category: (activeTab === 'all' && filterMealType === 'main') ? undefined : 'snack',
    userStores: activeTab === 'all' ? (filterStore.length > 0 ? filterStore : undefined) : (showAllStores ? undefined : selectedStores),
    limitByStore: activeTab === 'deals' && !showAllStores && selectedStores.length === 1,
    dietTags: activeTab === 'all' && filterDiet.length > 0 ? filterDiet : undefined,
  });

  const loading = loadingMain || loadingSnacks;

  useEffect(() => {
    loadUserStores();
    findCheapestStore();
  }, [user]);

  const loadUserStores = async () => {
    if (!user) return;
    const stores = await storePreferencesService.getSelectedStores(user.id);
    setUserStores(stores);
  };

  const findCheapestStore = async () => {
    try {
      const supabase = getSupabaseClient();
      const allStores = ['metro', 'iga', 'superc', 'maxi', 'walmart'];
      const storePrices = await Promise.all(
        allStores.map(async (store) => {
          const { data } = await supabase
            .from('recipes_with_best_store')
            .select('total_price')
            .eq('best_store', store)
            .limit(20);
          const avgPrice = data && data.length > 0
            ? data.reduce((sum, r) => sum + (parseFloat(String(r.total_price)) || 0), 0) / data.length
            : Infinity;
          return { store, avgPrice };
        })
      );
      const cheapest = storePrices.reduce((min, current) => current.avgPrice < min.avgPrice ? current : min);
      setCheapestStore(cheapest.store);
      setSelectedStores([cheapest.store]);
    } catch {
      setCheapestStore('metro');
      setSelectedStores(['metro']);
    }
  };

  const activeFiltersCount = filterStore.length + filterDiet.length + (filterMealType !== 'all' ? 1 : 0);

  const renderTabBar = () => (
    <View style={styles.tabBar}>
      <Pressable style={[styles.tab, activeTab === 'deals' && styles.tabActive]} onPress={() => setActiveTab('deals')}>
        <Text style={[styles.tabText, activeTab === 'deals' && styles.tabTextActive]}>Les Bons Plans</Text>
      </Pressable>
      <Pressable style={[styles.tab, activeTab === 'all' && styles.tabActive]} onPress={() => setActiveTab('all')}>
        <Text style={[styles.tabText, activeTab === 'all' && styles.tabTextActive]}>Toutes les recettes</Text>
      </Pressable>

    </View>
  );

  const renderStoreFilter = () => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storeFilterContent} style={styles.storeFilterScroll}>
      {['metro', 'iga', 'superc', 'maxi', 'walmart'].map(store => (
        <Pressable key={store} style={[styles.storeChip, selectedStores.includes(store) && styles.storeChipActive]}
          onPress={() => { setShowAllStores(false); setSelectedStores([store]); }}>
          <View style={styles.storeChipContent}>
            <Text style={[styles.storeChipText, selectedStores.includes(store) && styles.storeChipTextActive]}>
              {store.toUpperCase()}
            </Text>
            {store === cheapestStore && (
              <MaterialIcons name="star" size={16} color={selectedStores.includes(store) ? colors.surface : colors.accent} />
            )}
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );

  const renderFiltersModal = () => (
    <Modal visible={showFilters} animationType="slide" transparent onRequestClose={() => setShowFilters(false)}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Filtres</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              {activeFiltersCount > 0 && (
                <Pressable onPress={() => { setFilterStore([]); setFilterDiet([]); setFilterMealType('all'); }}>
                  <Text style={{ color: colors.primary, ...typography.body }}>Réinitialiser</Text>
                </Pressable>
              )}
              <Pressable onPress={() => setShowFilters(false)}>
                <MaterialIcons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>
          </View>
          <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl }}>
            <Text style={styles.filterLabel}>Type de repas</Text>
            <View style={styles.filterRow}>
              {[{k:'all',l:'Tous'},{k:'main',l:'Plats principaux'},{k:'snack',l:'Collations'}].map(({k,l}) => (
                <Pressable key={k} style={[styles.filterChip, filterMealType === k && styles.filterChipActive]} onPress={() => setFilterMealType(k as any)}>
                  <Text style={[styles.filterChipText, filterMealType === k && styles.filterChipTextActive]}>{l}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={[styles.filterLabel, { marginTop: spacing.lg }]}>Meilleur prix chez</Text>
            <View style={styles.filterRow}>
              {['metro','iga','superc','maxi','walmart'].map(store => (
                <Pressable key={store} style={[styles.filterChip, filterStore.includes(store) && styles.filterChipActive]}
                  onPress={() => setFilterStore(prev => prev.includes(store) ? prev.filter(s => s !== store) : [...prev, store])}>
                  <Text style={[styles.filterChipText, filterStore.includes(store) && styles.filterChipTextActive]}>{store.toUpperCase()}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={[styles.filterLabel, { marginTop: spacing.lg }]}>Diète alimentaire</Text>
            <View style={styles.filterRow}>
              {[{label:'Végétarien',value:'végétarien'},{label:'Végétalien',value:'végétalien'},{label:'Sans gluten',value:'sans gluten'},{label:'Sans lactose',value:'sans lactose'},{label:'Keto',value:'keto'}].map(diet => (
                <Pressable key={diet.value} style={[styles.filterChip, filterDiet.includes(diet.value) && styles.filterChipActive]}
                  onPress={() => setFilterDiet(prev => prev.includes(diet.value) ? prev.filter(d => d !== diet.value) : [...prev, diet.value])}>
                  <Text style={[styles.filterChipText, filterDiet.includes(diet.value) && styles.filterChipTextActive]}>{diet.label}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
          <Pressable style={styles.applyButton} onPress={() => setShowFilters(false)}>
            <Text style={styles.applyButtonText}>Voir les recettes</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );

  const isRecipeInMenu = (recipeId: string) => {
    return Array.isArray(menuItems) && menuItems.some(item => item.recipe_id === recipeId);
  };

  const handleToggleRecipe = async (recipe: any) => {
    if (isRecipeInMenu(recipe.id)) {
      const menuItem = menuItems.find((item) => item.recipe_id === recipe.id);
      if (menuItem) await removeMenuItem(menuItem.id);
    } else {
      await addMenuItem({ recipe_id: recipe.id, title: recipe.title, servings: recipe.servings || 4, totalPrice: recipe.totalPrice || 0 });
    }
  };

  const renderRecipeCard = (recipe: any) => {
    const pricePerServing = recipe.servings && recipe.servings > 0 ? recipe.totalPrice / recipe.servings : recipe.totalPrice;
    const inMenu = isRecipeInMenu(recipe.id);
    return (
      <Pressable key={recipe.id} style={styles.recipeCard} onPress={() => router.push(`/recipe/${recipe.id}`)}>
        <View style={styles.recipeImageContainer}>
          {recipe.image && recipe.image.startsWith('http') ? (
            <Image source={{ uri: recipe.image }} style={styles.recipeImage} contentFit="cover" transition={200} />
          ) : (
            <View style={[styles.recipeImage, styles.recipeImagePlaceholder]} />
          )}
          {recipe.bestStore && recipe.bestStore !== 'N/A' && (
            <View style={styles.storeBadgeOverlay}>
              <Text style={styles.storeBadgeText}>{recipe.bestStore.toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.priceBadgeOverlay}>
            {pricePerServing > 0 && <Text style={styles.priceBadgeText}>{pricePerServing.toFixed(2)}$/portion</Text>}
          </View>
        </View>
        <View style={styles.recipeInfo}>
  <Text style={styles.recipeTitle}>{recipe.title}</Text>
  <View style={styles.recipeBottom}>
    <View style={styles.recipeTags}>
      {[...(recipe.diet_tags || []), ...(recipe.tags || [])].slice(0, 3).map((tag: string, idx: number) => (
        <View key={idx} style={styles.tag}><Text style={styles.tagText}>{tag}</Text></View>
      ))}
    </View>
    <Pressable style={[styles.addButton, inMenu && styles.addButtonActive]} onPress={() => handleToggleRecipe(recipe)}>
      <MaterialIcons name={inMenu ? "check" : "add"} size={24} color={inMenu ? colors.surface : colors.primary} />
    </Pressable>
  </View>
</View>
      </Pressable>
    );
  };

  const handleSubscription = () => router.push('/subscription');

  const hasAccess = isSubscribed || isTrial;

  if (!hasAccess) {
    return (
      <View style={styles.container}>
        <View style={[styles.hero, { paddingTop: insets.top + spacing.xl }]}>
          <View style={styles.greetingRow}>
          <Text style={styles.greeting}>Recettes</Text>
          {activeTab === 'all' && (
            <Pressable style={styles.filterIconButton} onPress={() => setShowFilters(true)}>
              <MaterialIcons name="tune" size={22} color="#fff" />
              {activeFiltersCount > 0 && (
                <View style={styles.filterIconBadge}>
                  <Text style={styles.filterIconBadgeText}>{activeFiltersCount}</Text>
                </View>
              )}
            </Pressable>
          )}
        </View>
        </View>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.lockedContent} showsVerticalScrollIndicator={false}>
          <View style={styles.lockedContainer}>
            <Text style={styles.lockedTitle}>L'abonnement te fait économiser plus</Text>
            <Text style={styles.lockedText}>Accède à toutes les recettes, compare les prix et économise en moyenne 1 250$ par année!</Text>
            <View style={styles.pricingCard}>
              <Text style={styles.pricingPeriod}>Mensuel</Text>
              <Text style={styles.pricingAmount}>5$ /mois</Text>
              <Text style={styles.pricingTrial}>7 jours gratuits!</Text>
              <Pressable style={styles.pricingButton} onPress={() => handleSubscription('monthly')} disabled={subscriptionLoading}>
                {subscriptionLoading ? <ActivityIndicator size="small" color={colors.text} /> : <Text style={styles.pricingButtonText}>Commencer l'essai gratuit</Text>}
              </Pressable>
            </View>
            <View style={[styles.pricingCard, styles.pricingCardPopular]}>
              <View style={styles.popularBadge}><Text style={styles.popularBadgeText}>+ populaire</Text></View>
              <Text style={styles.pricingPeriod}>Annuel</Text>
              <Text style={styles.pricingAmount}>50$ /an</Text>
              <Text style={styles.pricingTrial}>7 jours gratuits!</Text>
              <Pressable style={styles.pricingButton} onPress={() => handleSubscription('yearly')} disabled={subscriptionLoading}>
                {subscriptionLoading ? <ActivityIndicator size="small" color={colors.text} /> : <Text style={styles.pricingButtonText}>Commencer l'essai gratuit</Text>}
              </Pressable>
            </View>
            <View style={styles.freeAccessInfo}>
              <MaterialIcons name="info-outline" size={20} color={colors.textSecondary} />
              <Text style={styles.freeAccessText}>Sans abonnement, vous pouvez uniquement consulter la circulaire et les rabais.</Text>
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.loadingContainer}><ActivityIndicator size="large" color={colors.primary} /></View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.hero, { paddingTop: insets.top + spacing.xl }]}>
        <View style={styles.greetingRow}>
          <Text style={styles.greeting}>Recettes</Text>
          {activeTab === 'all' && (
            <Pressable style={styles.filterIconButton} onPress={() => setShowFilters(true)}>
              <MaterialIcons name="tune" size={22} color="#fff" />
              {activeFiltersCount > 0 && (
                <View style={styles.filterIconBadge}>
                  <Text style={styles.filterIconBadgeText}>{activeFiltersCount}</Text>
                </View>
              )}
            </Pressable>
          )}
        </View>

        {renderTabBar()}
        {activeTab === 'deals' && renderStoreFilter()}
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.recipeList} showsVerticalScrollIndicator={false}>
        {activeTab === 'deals' ? (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Plats Principaux</Text>
              {loadingMain ? <View style={styles.loadingContainer}><ActivityIndicator size="large" color={colors.primary} /></View>
                : mainRecipes.length === 0 ? <View style={styles.emptyList}><Text style={styles.emptyListText}>Aucune recette trouvée</Text></View>
                : mainRecipes.map(recipe => renderRecipeCard(recipe))}
            </View>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Collations</Text>
              {loadingSnacks ? <View style={styles.loadingContainer}><ActivityIndicator size="large" color={colors.primary} /></View>
                : snackRecipes.length === 0 ? <View style={styles.emptyList}><Text style={styles.emptyListText}>Aucune recette trouvée</Text></View>
                : snackRecipes.map(recipe => renderRecipeCard(recipe))}
            </View>
          </>
        ) : (
          <View style={styles.section}>
            {(loadingMain || loadingSnacks) ? <View style={styles.loadingContainer}><ActivityIndicator size="large" color={colors.primary} /></View>
              : [...mainRecipes, ...snackRecipes].length === 0 ? <View style={styles.emptyList}><Text style={styles.emptyListText}>Aucune recette trouvée</Text></View>
              : [...mainRecipes, ...snackRecipes].sort((a, b) => (b.likes || 0) - (a.likes || 0)).map(recipe => renderRecipeCard(recipe))}
          </View>
        )}
      </ScrollView>

      {renderFiltersModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  hero: { backgroundColor: colors.darkBeige, paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.lg, borderBottomLeftRadius: borderRadius.xl, borderBottomRightRadius: borderRadius.xl },
  greetingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
  greeting: { ...typography.h1, color: colors.text, fontFamily: 'InstrumentSerif_400Regular', fontSize: 48 },
  subtitle: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.sm },
  tabBar: { flexDirection: 'row', paddingTop: spacing.xs, gap: spacing.sm, alignItems: 'center' },
  tab: { flex: 1, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: borderRadius.full, backgroundColor: 'transparent', alignItems: 'center', borderWidth: 2, borderColor: colors.primary },
  tabActive: { backgroundColor: colors.primary },
  tabText: { ...typography.bodyBold, fontSize: 15, color: colors.primary },
  tabTextActive: { color: '#fff' },
  filterIconButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  filterIconBadge: { position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: 8, backgroundColor: '#d4b5ff', alignItems: 'center', justifyContent: 'center' },
  filterIconBadgeText: { fontSize: 10, fontWeight: '700', color: '#fff' },
  storeFilterScroll: { marginTop: spacing.sm },
  storeFilterContent: { flexDirection: 'row', gap: spacing.sm },
  storeChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.full, backgroundColor: colors.surface },
  storeChipContent: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  storeChipActive: { backgroundColor: colors.accent },
  storeChipText: { ...typography.captionBold, color: colors.text },
  storeChipTextActive: { color: colors.surface },
  scrollView: { flex: 1 },
  section: { marginBottom: spacing.xl },
  sectionTitle: { ...typography.h2, fontSize: 22, fontWeight: '600', color: '#000000', paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xs },
  sectionSubtitle: { ...typography.caption, color: '#000000', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, marginBottom: spacing.sm },
  recipeList: { paddingBottom: 120, paddingTop: spacing.lg },
  emptyList: { paddingVertical: spacing.xl, alignItems: 'center', gap: spacing.md },
  emptyListText: { ...typography.body, color: colors.textSecondary },
  recipeCard: { backgroundColor: colors.primary, borderRadius: borderRadius.lg, overflow: 'hidden', marginBottom: spacing.md, marginHorizontal: spacing.lg },
  recipeImageContainer: { position: 'relative', width: '100%' },
  recipeImage: { width: '100%', height: 175, backgroundColor: colors.border, borderWidth: 2, borderColor: colors.primary, borderRadius: borderRadius.lg },
  recipeImagePlaceholder: { justifyContent: 'center', alignItems: 'center' },
  storeBadgeOverlay: { position: 'absolute', top: 12, left: 12, backgroundColor: colors.surface, borderRadius: borderRadius.md, paddingHorizontal: spacing.sm, paddingVertical: 6 },
  storeBadgeText: { ...typography.small, fontSize: 11, fontWeight: '600', color: colors.primary },
  priceBadgeOverlay: { position: 'absolute', top: 12, right: 12, backgroundColor: colors.surface, borderRadius: borderRadius.md, paddingHorizontal: spacing.sm, paddingVertical: 6 },
  priceBadgeText: { ...typography.small, fontSize: 11, fontWeight: '700', color: colors.primary },
  recipeInfo: { padding: spacing.md, justifyContent: 'space-between', minHeight: 100 },
  recipeTitle: { fontSize: 22, fontWeight: '400', lineHeight: 26, color: colors.surface, marginBottom: spacing.sm, fontFamily: 'InstrumentSerif_400Regular' },
  recipeTags: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap', marginBottom: spacing.sm },
  tag: { backgroundColor: colors.surface, borderRadius: borderRadius.full, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  tagText: { ...typography.small, color: colors.primary },
  recipeBottom: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 'auto' },
  addButton: { width: 40, height: 40, borderRadius: borderRadius.full, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center' },
  addButtonActive: { backgroundColor: '#FFD4CC' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  filterLabel: { ...typography.bodyBold, fontSize: 13, color: colors.text, marginBottom: spacing.sm },
  filterRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', marginBottom: spacing.sm },
  filterChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.full, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterChipText: { ...typography.caption, color: colors.text },
  filterChipTextActive: { color: colors.surface, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContainer: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle: { ...typography.h2, color: colors.text },
  applyButton: { margin: spacing.lg, backgroundColor: colors.primary, borderRadius: borderRadius.full, paddingVertical: spacing.md, alignItems: 'center' },
  applyButtonText: { ...typography.bodyBold, color: '#fff', fontSize: 16 },
  lockedContent: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  lockedContainer: { alignItems: 'center', paddingVertical: spacing.sm, paddingBottom: 20 },
  lockedTitle: { fontSize: 28, fontWeight: '800', color: colors.text, textAlign: 'center', marginTop: spacing.xs, marginBottom: spacing.sm, fontFamily: 'OpenSans_600SemiBold', letterSpacing: -0.8 },
  lockedText: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.sm, lineHeight: 20, fontSize: 13 },
  pricingCard: { width: '100%', backgroundColor: colors.surface, borderRadius: borderRadius.xl, padding: spacing.md, marginBottom: spacing.sm, alignItems: 'center', borderWidth: 2, borderColor: colors.border, position: 'relative' },
  pricingCardPopular: { borderColor: colors.accent, borderWidth: 3 },
  popularBadge: { position: 'absolute', top: -12, right: spacing.lg, backgroundColor: colors.accent, borderRadius: borderRadius.full, paddingVertical: 4, paddingHorizontal: spacing.md },
  popularBadgeText: { fontSize: 12, fontWeight: '700', color: colors.surface },
  pricingPeriod: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 2 },
  pricingAmount: { fontSize: 26, fontWeight: '400', color: colors.text, marginBottom: spacing.xs, ...Platform.select({ ios: { fontFamily: 'Georgia' }, android: { fontFamily: 'serif' }, default: { fontFamily: 'Georgia' } }) },
  pricingTrial: { fontSize: 14, color: colors.textSecondary, marginBottom: spacing.md },
  pricingButton: { backgroundColor: '#ebcdf1', borderRadius: borderRadius.full, paddingVertical: spacing.md, paddingHorizontal: spacing.xl },
  pricingButtonText: { fontSize: 14, fontWeight: '600', color: colors.text },
  freeAccessInfo: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.md, marginTop: spacing.md },
  freeAccessText: { flex: 1, fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
});
