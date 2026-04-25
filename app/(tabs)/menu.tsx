import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Image,
  Linking,
  Platform,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFonts, InstrumentSerif_400Regular } from '@expo-google-fonts/instrument-serif';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows, storeInfo } from '@/constants/theme';
import { useWeeklyMenu } from '@/hooks/useWeeklyMenu';
import { supabase } from '@/lib/supabase';
import { DayOfWeek, weeklyMenuService } from '@/services/weeklyMenuService';
import { optimizedRecipeService } from '@/services/optimizedRecipeService';
import { Recipe } from '@/types';
import { useSubscription } from '@/hooks/useSubscription';
import { useAlert, useAuth } from '@/template';

export default function WeeklyMenuScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { menuItems, removeMenuItem, clearMenu, updateDay, updateServings, updateStore, loading } = useWeeklyMenu();
  const { isSubscribed, isTrial } = useSubscription();
  const { showAlert } = useAlert();
  const { user } = useAuth();
  const [fullRecipes, setFullRecipes] = useState<Recipe[]>([]);
  const [loadingRecipes, setLoadingRecipes] = useState(false);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [showDayPicker, setShowDayPicker] = useState(false);
  const [storePrices, setStorePrices] = useState<Record<string, Record<string, number>>>({});
  const [globalStore, setGlobalStore] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const daysOfWeek: DayOfWeek[] = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

  // Charger les détails complets des recettes du menu
  useEffect(() => {
    async function loadMenuRecipes() {
      if (menuItems.length === 0) {
        setFullRecipes([]);
        return;
      }

      setLoadingRecipes(true);
      const recipePromises = menuItems.map(item =>
        optimizedRecipeService.getRecipeById(item.recipe_id)
      );
      const recipes = await Promise.all(recipePromises);
      const filteredRecipes = recipes.filter(Boolean) as Recipe[];
      setFullRecipes(filteredRecipes);

      // Charger les prix par épicerie pour chaque recette
      const recipeIds = menuItems.map(item => item.recipe_id);
      if (recipeIds.length > 0) {
        const { data: prices } = await supabase
          .from('recipe_store_prices')
          .select('recipe_id, total_price, ingredients_covered, ingredients_total, stores(code)')
          .in('recipe_id', recipeIds);

        const priceMap: Record<string, Record<string, number>> = {};
        (prices || []).forEach((p: any) => {
          if (p.total_price > 0) {
            if (!priceMap[p.recipe_id]) priceMap[p.recipe_id] = {};
            priceMap[p.recipe_id][p.stores.code] = p.total_price;
          }
        });
        setStorePrices(priceMap);
      }

      setLoadingRecipes(false);
    }

    loadMenuRecipes();
  }, [menuItems]);

  const handleSubscription = async (plan: 'monthly' | 'yearly') => {
    if (subscriptionLoading) return;
    setSubscriptionLoading(true);
    try {
      const { revenueCatService } = await import('@/services/revenueCatService');
      if (user) await revenueCatService.setUserId(user.id);
      const { success, error } = await revenueCatService.purchasePlan(plan);
      if (success) {
        showAlert('Succès', 'Votre essai gratuit est maintenant actif !');
      } else if (error && !error.userCancelled) {
        showAlert(
          'Erreur',
          error?.noOfferings
            ? 'Aucun forfait disponible pour le moment. Réessayez plus tard.'
            : (error?.message || "Impossible de démarrer l'essai. Veuillez réessayer.")
        );
      }
    } finally {
      setSubscriptionLoading(false);
    }
  };

  const handleClearMenu = () => {
    showAlert(
      'Supprimer le menu',
      'Êtes-vous sûr de vouloir supprimer tout le menu hebdomadaire?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            await clearMenu();
          },
        },
      ]
    );
  };

  const handleOpenDayPicker = (itemId: string) => {
    setSelectedItemId(itemId);
    setShowDayPicker(true);
  };

  const handleSelectDay = async (day: DayOfWeek) => {
    if (selectedItemId) {
      await updateDay(selectedItemId, day);
    }
    setShowDayPicker(false);
    setSelectedItemId(null);
  };

  // Vérifier l'accès (abonné ou en période d'essai)
  const hasAccess = isSubscribed || isTrial;

  // Loading state pendant la vérification de l'abonnement
  if (loading || loadingRecipes) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Chargement du menu...</Text>
        </View>
      </View>
    );
  }

  if (!hasAccess) {
    return (
      <View style={styles.container}>
        <View style={[styles.hero, { paddingTop: insets.top + spacing.xl }]}>
          <Text style={styles.greeting}>Menu hebdomadaire</Text>
        </View>

        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.lockedContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.lockedContainer}>
            <Text style={styles.lockedTitle}>L'abonnement te fait économiser plus</Text>
            <Text style={styles.lockedText}>
              Accède à toutes les recettes, compare les prix et économise en moyenne 1 250$ par année!
            </Text>

            {/* Pricing Cards */}
            <View style={styles.pricingCard}>
              <Text style={styles.pricingPeriod}>Mensuel</Text>
              <Text style={styles.pricingAmount}>5$ /mois</Text>
              <Text style={styles.pricingTrial}>7 jours gratuits!</Text>
              <Pressable 
                style={styles.pricingButton}
                onPress={() => handleSubscription('monthly')}
                disabled={subscriptionLoading}
              >
                {subscriptionLoading ? (
                  <ActivityIndicator size="small" color={colors.text} />
                ) : (
                  <Text style={styles.pricingButtonText}>Commencer l'essai gratuit</Text>
                )}
              </Pressable>
            </View>

            <View style={[styles.pricingCard, styles.pricingCardPopular]}>
              <View style={styles.popularBadge}>
                <Text style={styles.popularBadgeText}>+ populaire</Text>
              </View>
              <Text style={styles.pricingPeriod}>Annuel</Text>
              <Text style={styles.pricingAmount}>50$ /an</Text>
              <Text style={styles.pricingTrial}>7 jours gratuits!</Text>
              <Pressable 
                style={styles.pricingButton}
                onPress={() => handleSubscription('yearly')}
                disabled={subscriptionLoading}
              >
                {subscriptionLoading ? (
                  <ActivityIndicator size="small" color={colors.text} />
                ) : (
                  <Text style={styles.pricingButtonText}>Commencer l'essai gratuit</Text>
                )}
              </Pressable>
            </View>

            <View style={styles.freeAccessInfo}>
              <MaterialIcons name="info-outline" size={20} color={colors.textSecondary} />
              <Text style={styles.freeAccessText}>
                Sans abonnement, vous pouvez uniquement consulter la circulaire et les rabais.
              </Text>
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  if (loading || loadingRecipes) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Chargement du menu...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Hero Section */}
      <View style={[styles.hero, { paddingTop: insets.top + spacing.xl }]}>
        <View style={styles.heroTop}>
          <View style={styles.heroTextContainer}>
            <Text style={styles.greeting}>Menu hebdomadaire</Text>
            <Text style={styles.subtitle}>
              {menuItems.length === 0
                ? 'Planifiez vos repas de la semaine'
                : `${menuItems.length} recette${menuItems.length > 1 ? 's' : ''} au menu`}
            </Text>
          </View>
          {menuItems.length > 0 && (
            <Pressable
              onPress={handleClearMenu}
              style={({ pressed }) => [
                styles.clearMenuButton,
                pressed && { opacity: 0.7 },
              ]}
              hitSlop={12}
            >
              <MaterialIcons name="delete-outline" size={24} color={colors.error} />
            </Pressable>
          )}
        </View>

        {menuItems.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
            {['metro', 'iga', 'superc', 'maxi', 'walmart'].map(store => {
              const selected = globalStore === store;
              return (
                <Pressable key={store} onPress={() => {
                  const newStore = selected ? null : store;
                  setGlobalStore(newStore);
                  if (newStore) menuItems.forEach(item => updateStore(item.id, newStore));
                }} style={[styles.heroStoreChip, selected && styles.heroStoreChipActive]}>
                  <Text style={[styles.heroStoreChipText, selected && styles.heroStoreChipTextActive]}>{store.toUpperCase()}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        {menuItems.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>Menu vide</Text>
            <Text style={styles.emptyText}>
              Parcourez les recettes et ajoutez-les à votre menu hebdomadaire
            </Text>
            <Pressable
              style={styles.browseButton}
              onPress={() => router.push('/(tabs)')}
            >
              <Text style={styles.browseButtonText}>Parcourir les recettes</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {/* Total Cost Banner */}
            {(() => {
              const total = menuItems.reduce((sum, menuItem) => {
                const recipe = fullRecipes.find(r => r.id === menuItem.recipe_id);
                if (!recipe) return sum;
                const ratio = recipe.servings > 0 ? (menuItem.servings || recipe.servings) / recipe.servings : 1;
                const selectedStore = menuItem.store_code || recipe.bestStore;
                const basePrice = storePrices[recipe.id]?.[selectedStore] ?? recipe.totalPrice ?? 0;
                console.log('[cost] recipe:', recipe.title, 'basePrice:', basePrice, 'ratio:', ratio, 'totalPrice:', recipe.totalPrice, 'storePrices:', storePrices[recipe.id]);
                return sum + (basePrice * ratio);
              }, 0);
              return (
                <View style={styles.costBanner}>
                  <Text style={styles.costLabel}>Coût total estimé cette semaine</Text>
                  <Text style={styles.costAmount}>{total.toFixed(2)}$</Text>
                </View>
              );
            })()}

            {/* Recipe Cards - Groupés par jour de la semaine */}
            {(() => {
              const daysOrder = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche', undefined];
              const recipesByDay: Record<string, typeof fullRecipes> = {};
              
              fullRecipes.forEach(recipe => {
                const menuItem = menuItems.find(item => item.recipe_id === recipe.id);
                const day = menuItem?.day || 'Sans jour';
                if (!recipesByDay[day]) recipesByDay[day] = [];
                recipesByDay[day].push(recipe);
              });

              const sortedDays = Object.keys(recipesByDay).sort((a, b) => {
                const ai = daysOrder.indexOf(a as any);
                const bi = daysOrder.indexOf(b as any);
                if (a === 'Sans jour') return 1;
                if (b === 'Sans jour') return -1;
                return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
              });
              
              return (
                <>
                  {sortedDays.map(day => (
                    <View key={day} style={styles.categorySection}>
                      
                      <View style={styles.recipeList}>
                        {recipesByDay[day].map((recipe) => {
                          const menuItem = menuItems.find(item => item.recipe_id === recipe.id);
                          return (
                          <Pressable
                            key={recipe.id}
                            style={styles.recipeCard}
                            onPress={() => router.push(`/recipe/${recipe.id}`)}
                          >
                            {/* Recipe Image */}
                            <View style={styles.imageContainer}>
                              {recipe.image && recipe.image.startsWith('http') ? (
                                <Image 
                                  source={{ uri: recipe.image }} 
                                  style={styles.recipeImage}
                                  resizeMode="cover"
                                />
                              ) : (
                                <View style={[styles.recipeImage, styles.imagePlaceholder]} />
                              )}
                              
                              {/* Remove Button */}
                              <Pressable
                                onPress={(e) => {
                                  e.stopPropagation();
                                  if (menuItem) {
                                    removeMenuItem(menuItem.id);
                                  }
                                }}
                                style={styles.removeButtonOverlay}
                                hitSlop={12}
                              >
                                <MaterialIcons name="close" size={20} color={colors.surface} />
                              </Pressable>
                            </View>
                            
                            {/* Recipe Info */}
                            <View style={styles.cardContent}>
                              <Text style={styles.cardTitle} numberOfLines={2}>{recipe.title}</Text>
                              
                              {/* Day Selector */}
                              {menuItem && (
                                <Pressable
                                  onPress={(e) => {
                                    e.stopPropagation();
                                    handleOpenDayPicker(menuItem.id);
                                  }}
                                  style={({ pressed }) => [
                                    styles.daySelector,
                                    pressed && { opacity: 0.7 },
                                  ]}
                                >
                                  <MaterialIcons name="event" size={16} color={colors.primary} />
                                  <Text style={styles.daySelectorText}>
                                    {menuItem.day || 'Choisir un jour'}
                                  </Text>
                                  <MaterialIcons name="chevron-right" size={16} color={colors.textSecondary} />
                                </Pressable>
                              )}
                              
                              {/* Meta Info */}
                              <View style={styles.cardMeta}>
                                <View style={styles.metaItem}>
                                  <MaterialIcons name="schedule" size={16} color={colors.textSecondary} />
                                  <Text style={styles.metaText}>{recipe.prepTime} min</Text>
                                </View>

                              </View>
                              
                              {/* Portions selector */}
                              <View style={styles.portionsRow}>
                                <Text style={styles.portionsLabel}>Portions :</Text>
                                <Pressable onPress={(e) => { e.stopPropagation(); const s = Math.max(1, (menuItem?.servings || recipe.servings) - 1); updateServings(menuItem!.id, s); }} style={styles.portionBtn}>
                                  <Text style={styles.portionBtnText}>-</Text>
                                </Pressable>
                                <Text style={styles.portionsCount}>{menuItem?.servings || recipe.servings}</Text>
                                <Pressable onPress={(e) => { e.stopPropagation(); const s = (menuItem?.servings || recipe.servings) + 1; updateServings(menuItem!.id, s); }} style={styles.portionBtn}>
                                  <Text style={styles.portionBtnText}>+</Text>
                                </Pressable>
                              </View>



                              {/* Price Badge */}
                              {(() => {
                                const selectedStore = menuItems.find(m => m.id === menuItem?.id)?.store_code || recipe.bestStore;
                                const ratio = recipe.servings > 0 ? (menuItem?.servings || recipe.servings) / recipe.servings : 1;
                                const basePrice = storePrices[recipe.id]?.[selectedStore] ?? recipe.totalPrice;
                                console.log('[menu] store:', selectedStore, 'storePrices:', JSON.stringify(storePrices[recipe.id]), 'basePrice:', basePrice);
                                const price = basePrice * ratio;
                                return (
                                  <View style={styles.priceBadge}>
                                    <View style={styles.priceRow}>
                                      <View style={[styles.storeDot, { backgroundColor: storeInfo[selectedStore]?.color || colors.primary }]} />
                                      <Text style={styles.storeText}>{storeInfo[selectedStore]?.name || selectedStore}</Text>
                                    </View>
                                    <Text style={styles.priceText}>{price > 0 ? price.toFixed(2) + '$' : 'N/A'}</Text>
                                  </View>
                                );
                              })()}
                            </View>
                          </Pressable>
                        );})}
                      </View>
                    </View>
                  ))}
                </>
              );
            })()}
          </>
        )}

        <View style={{ height: spacing.xxl }} />
      </ScrollView>

      {/* Day Picker Modal */}
      <Modal
        visible={showDayPicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowDayPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + spacing.lg }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choisir un jour</Text>
              <Pressable
                onPress={() => setShowDayPicker(false)}
                hitSlop={12}
              >
                <MaterialIcons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>

            <View style={styles.daysList}>
              {/* Option pour retirer le jour */}
              <Pressable
                onPress={() => handleSelectDay(null)}
                style={({ pressed }) => [
                  styles.dayOption,
                  pressed && { backgroundColor: colors.surfaceLight },
                ]}
              >
                <MaterialIcons name="clear" size={24} color={colors.textSecondary} />
                <Text style={[styles.dayOptionText, { color: colors.textSecondary }]}>Aucun jour</Text>
              </Pressable>

              {/* Liste des jours */}
              {daysOfWeek.map((day) => (
                <Pressable
                  key={day}
                  onPress={() => handleSelectDay(day)}
                  style={({ pressed }) => [
                    styles.dayOption,
                    pressed && { backgroundColor: colors.surfaceLight },
                  ]}
                >
                  <MaterialIcons name="event" size={24} color={colors.primary} />
                  <Text style={styles.dayOptionText}>{day}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  hero: {
    backgroundColor: colors.darkBeige,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomLeftRadius: borderRadius.xl,
    borderBottomRightRadius: borderRadius.xl,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  heroTextContainer: {
    flex: 1,
  },
  clearMenuButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.error,
  },
  greeting: {
    ...typography.h1,
    color: colors.text,
    marginBottom: spacing.xs,
    fontFamily: 'InstrumentSerif_400Regular',
    fontSize: 48,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
  },
  scrollView: {
    flex: 1,
  },
  costBanner: {
    backgroundColor: colors.primary,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  costLabel: {
    ...typography.caption,
    color: colors.surface,
    marginBottom: spacing.xs,
  },
  costAmount: {
    ...typography.h1,
    color: colors.surface,
  },
  categorySection: {
    marginTop: spacing.lg,
  },
  categoryTitle: {
    ...typography.h2,
    color: colors.text,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  recipeList: {
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
  recipeCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: colors.accent,
    ...shadows.md,
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    height: 200,
  },
  recipeImage: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    backgroundColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },

  removeButtonOverlay: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    width: 32,
    height: 32,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: {
    padding: spacing.md,
  },
  cardTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  cardMeta: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  priceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.beige,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  storeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  storeText: {
    ...typography.captionBold,
    color: colors.text,
  },
  priceText: {
    ...typography.h3,
    color: colors.primary,
  },
  daySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.beige,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  daySelectorText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingTop: spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    ...typography.h2,
    color: colors.text,
  },
  daysList: {
    paddingTop: spacing.md,
  },
  dayOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  dayOptionText: {
    ...typography.body,
    color: colors.text,
    flex: 1,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  emptyTitle: {
    ...typography.h2,
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  browseButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  browseButtonText: {
    ...typography.bodyBold,
    color: colors.surface,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  lockedContent: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  lockedContainer: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingBottom: 20,
  },
  lockedTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
    fontFamily: 'OpenSans_600SemiBold',
    letterSpacing: -0.8,
  },
  lockedText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 24,
  },
  pricingCard: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    marginBottom: spacing.sm,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
    position: 'relative',
  },
  pricingCardPopular: {
    borderColor: colors.accent,
    borderWidth: 3,
  },
  popularBadge: {
    position: 'absolute',
    top: -12,
    right: spacing.lg,
    backgroundColor: colors.accent,
    borderRadius: borderRadius.full,
    paddingVertical: 4,
    paddingHorizontal: spacing.md,
  },
  popularBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.surface,
  },
  pricingPeriod: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  pricingAmount: {
    fontSize: 36,
    fontWeight: '400',
    color: colors.text,
    marginBottom: spacing.xs,
    ...Platform.select({
      ios: { fontFamily: 'Georgia' },
      android: { fontFamily: 'serif' },
      default: { fontFamily: 'Georgia' },
    }),
  },
  pricingTrial: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  pricingButton: {
    backgroundColor: '#ebcdf1',
    borderRadius: borderRadius.full,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  pricingButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.surface,
  },
  freeAccessInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  portionsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  portionsLabel: { fontSize: 14, color: colors.textSecondary },
  portionBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.beige, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  portionBtnText: { fontSize: 18, color: colors.text, fontWeight: '300' },
  portionsCount: { fontSize: 16, fontWeight: '600', color: colors.text, minWidth: 24, textAlign: 'center' },
  storeChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: colors.beige, borderWidth: 1, borderColor: colors.border },
  storeChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  storeChipText: { fontSize: 11, fontWeight: '600', color: colors.text },
  storeChipTextActive: { color: colors.surface },
  heroStoreChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#fff' },
  heroStoreChipActive: { backgroundColor: '#ff3131', borderColor: '#ff3131' },
  heroStoreChipText: { fontSize: 12, fontWeight: '700', color: colors.primary },
  heroStoreChipTextActive: { color: '#fff' },
  freeAccessText: {
    flex: 1,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
});
