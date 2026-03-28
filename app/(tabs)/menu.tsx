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
import { MaterialIcons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows, storeInfo } from '@/constants/theme';
import { useWeeklyMenu } from '@/hooks/useWeeklyMenu';
import { DayOfWeek, weeklyMenuService } from '@/services/weeklyMenuService';
import { optimizedRecipeService } from '@/services/optimizedRecipeService';
import { Recipe } from '@/types';
import { useSubscription } from '@/hooks/useSubscription';
import { createCheckoutSession } from '@/services/subscriptionService';
import { SUBSCRIPTION_TIERS } from '@/constants/subscription';
import { useAlert } from '@/template';

export default function WeeklyMenuScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { menuItems, totalCost, removeMenuItem, clearMenu, updateDay, loading } = useWeeklyMenu();
  const { isSubscribed, isTrial } = useSubscription();
  const { showAlert } = useAlert();
  const [fullRecipes, setFullRecipes] = useState<Recipe[]>([]);
  const [loadingRecipes, setLoadingRecipes] = useState(false);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [showDayPicker, setShowDayPicker] = useState(false);
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
      setFullRecipes(recipes.filter(Boolean) as Recipe[]);
      setLoadingRecipes(false);
    }

    loadMenuRecipes();
  }, [menuItems]);

  const handleSubscription = async (planType: 'monthly' | 'yearly') => {
    setSubscriptionLoading(true);
    
    const priceId = SUBSCRIPTION_TIERS[planType].price_id;
    const { url, error } = await createCheckoutSession(priceId);
    
    if (error || !url) {
      showAlert('Erreur', error || 'Impossible de créer la session de paiement');
      setSubscriptionLoading(false);
      return;
    }
    
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        showAlert('Erreur', 'Impossible d\'ouvrir le lien de paiement');
      }
    } catch (err) {
      showAlert('Erreur', 'Une erreur est survenue lors de l\'ouverture du paiement');
    }
    
    setSubscriptionLoading(false);
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
          <Text style={styles.greeting}>Menu hebdomadaire,</Text>
          <Text style={styles.subtitle}>Planifiez vos repas de la semaine</Text>
        </View>

        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.lockedContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.lockedContainer}>
            <MaterialIcons name="menu-book" size={80} color={colors.border} />
            <Text style={styles.lockedTitle}>L'abonnement te fait économiser plus</Text>
            <Text style={styles.lockedText}>
              Planifiez vos menus hebdomadaires et économisez en moyenne de 1250$ par année!
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
            <Text style={styles.greeting}>Menu hebdomadaire,</Text>
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
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        {menuItems.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialIcons name="menu-book" size={80} color={colors.border} />
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
            <View style={styles.costBanner}>
              <Text style={styles.costLabel}>Coût total estimé cette semaine</Text>
              <Text style={styles.costAmount}>{(totalCost || 0).toFixed(2)}$</Text>
            </View>

            {/* Recipe Cards - Groupés par catégorie */}
            {(() => {
              const mainDishes = fullRecipes.filter(r => r.category === 'main');
              const snacks = fullRecipes.filter(r => r.category === 'snack');
              
              return (
                <>
                  {/* Plats principaux */}
                  {mainDishes.length > 0 && (
                    <View style={styles.categorySection}>
                      <Text style={styles.categoryTitle}>Plats principaux</Text>
                      <View style={styles.recipeList}>
                        {mainDishes.map((recipe) => {
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
                                <View style={styles.metaItem}>
                                  <MaterialIcons name="restaurant" size={16} color={colors.textSecondary} />
                                  <Text style={styles.metaText}>{recipe.servings} portions</Text>
                                </View>
                              </View>
                              
                              {/* Price Badge */}
                              <View style={styles.priceBadge}>
                                <View style={styles.priceRow}>
                                  <View style={[styles.storeDot, { backgroundColor: storeInfo[recipe.bestStore]?.color || colors.primary }]} />
                                  <Text style={styles.storeText}>{storeInfo[recipe.bestStore]?.name || 'N/A'}</Text>
                                </View>
                                <Text style={styles.priceText}>{recipe.totalPrice.toFixed(2)}$</Text>
                              </View>
                            </View>
                          </Pressable>
                        );})}
                      </View>
                    </View>
                  )}
                  
                  {/* Collations */}
                  {snacks.length > 0 && (
                    <View style={styles.categorySection}>
                      <Text style={styles.categoryTitle}>Collations</Text>
                      <View style={styles.recipeList}>
                        {snacks.map((recipe) => {
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
                                <View style={styles.metaItem}>
                                  <MaterialIcons name="restaurant" size={16} color={colors.textSecondary} />
                                  <Text style={styles.metaText}>{recipe.servings} portions</Text>
                                </View>
                              </View>
                              
                              {/* Price Badge */}
                              <View style={styles.priceBadge}>
                                <View style={styles.priceRow}>
                                  <View style={[styles.storeDot, { backgroundColor: storeInfo[recipe.bestStore]?.color || colors.primary }]} />
                                  <Text style={styles.storeText}>{storeInfo[recipe.bestStore]?.name || 'N/A'}</Text>
                                </View>
                                <Text style={styles.priceText}>{recipe.totalPrice.toFixed(2)}$</Text>
                              </View>
                            </View>
                          </Pressable>
                        );})}
                      </View>
                    </View>
                  )}
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
    backgroundColor: colors.darkBeige, // Beige foncé #f1e7dd
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
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
    paddingVertical: spacing.xl,
    paddingBottom: 150,
  },
  lockedTitle: {
    fontSize: 32,
    fontWeight: '400',
    color: colors.text,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
    ...Platform.select({
      ios: { fontFamily: 'Georgia' },
      android: { fontFamily: 'serif' },
      default: { fontFamily: 'Georgia' },
    }),
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
    padding: spacing.xl,
    marginBottom: spacing.lg,
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
    backgroundColor: colors.primary,
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
  freeAccessText: {
    flex: 1,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
});
