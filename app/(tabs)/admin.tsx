import React, { useState, useEffect, useCallback } from 'react';
import { ProductManagementModal } from '@/components/feature/ProductManagementModal';
import { RecipeManagementModal } from '@/components/feature/RecipeManagementModal';
import { RecipeCostDetailModal } from '@/components/feature/RecipeCostDetailModal';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import { getSupabaseClient } from '@/template';
import {
  getPromotionsStatus,
  getPromotionsByStore,
  StorePromotionCount,
} from '@/services/weeklyPromotionsService';
import { cleanupDuplicateProducts } from '@/services/cleanupService';
import { scrapeAllIngredients, scrapeAllIngredientsWithGoogle, scrapeAllIngredientsWithFirecrawl, BulkScrapingProgress } from '@/services/bulkIngredientScrapingService';

type TabType = 'recipes' | 'products' | 'ingredients' | 'scraping';

export default function AdminScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const supabase = getSupabaseClient();
  const [activeTab, setActiveTab] = useState<TabType>('scraping');

  // Scraping tab
  const [postalCode, setPostalCode] = useState('H3A 0G4');
  
  // Weekly promotions
  const [promoStatus, setPromoStatus] = useState<{
    activePromotions: number;
    lastScrapeDate?: string;
    nextExpireDate?: string;
  } | null>(null);
  const [promosByStore, setPromosByStore] = useState<StorePromotionCount[]>([]);
  const [updatingAllStores, setUpdatingAllStores] = useState(false);
  const [lastScrapeSummary, setLastScrapeSummary] = useState<string>('');
  const [cleaningDuplicates, setCleaningDuplicates] = useState(false);
  const [scrapingStores, setScrapingStores] = useState<Set<string>>(new Set());

  // Bulk ingredients scraping - Google Shopping
  const [scrapingGoogleShopping, setScrapingGoogleShopping] = useState(false);
  const [googleShoppingProgress, setGoogleShoppingProgress] = useState<BulkScrapingProgress | null>(null);

  // Bulk ingredients scraping - Firecrawl
  const [scrapingFirecrawl, setScrapingFirecrawl] = useState(false);
  const [firecrawlProgress, setFirecrawlProgress] = useState<BulkScrapingProgress | null>(null);

  // Classification AI des produits
  const [classifyingProducts, setClassifyingProducts] = useState(false);
  const [classificationProgress, setClassificationProgress] = useState<{
    processed: number;
    total: number;
    remaining: number;
  } | null>(null);

  // ANCIENNE VARIABLE (conservée pour compatibilité)
  const [scrapingAllIngredients, setScrapingAllIngredients] = useState(false);
  const [bulkScrapingProgress, setBulkScrapingProgress] = useState<BulkScrapingProgress | null>(null);

  const [loading, setLoading] = useState(false);
  
  // Products tab with pagination
  const [products, setProducts] = useState<any[]>([]);
  const [productModalVisible, setProductModalVisible] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [recipeModalVisible, setRecipeModalVisible] = useState(false);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);
  const [recipeCostModalVisible, setRecipeCostModalVisible] = useState(false);
  const [selectedRecipeForCost, setSelectedRecipeForCost] = useState<{ id: string; name: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMoreProducts, setHasMoreProducts] = useState(true);
  const PRODUCTS_PER_PAGE = 50;

  // Ingredients tab
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [ingredientSearchQuery, setIngredientSearchQuery] = useState('');
  const [loadingIngredients, setLoadingIngredients] = useState(false);

  // Recipes tab
  const [recipes, setRecipes] = useState<any[]>([]);
  const [recipeSearchQuery, setRecipeSearchQuery] = useState('');
  const [loadingRecipes, setLoadingRecipes] = useState(false);

  useEffect(() => {
    if (activeTab === 'scraping') {
      loadPromoStatus();
    } else if (activeTab === 'products') {
      loadProducts();
    } else if (activeTab === 'ingredients') {
      loadIngredients();
    } else if (activeTab === 'recipes') {
      loadRecipes();
    }
  }, [activeTab]);

  // 🔄 Rafraîchir TOUJOURS quand on revient sur cette page (fonctionne après admin-scraper)
  useFocusEffect(
    useCallback(() => {
      console.log('[Admin] Page refocused - rafraîchissement forcé...');
      // Forcer le rafraîchissement en réinitialisant l'état puis en rechargeant
      setProducts([]);
      setIngredients([]);
      setRecipes([]);
      setCurrentPage(0);
      
      // Délai court pour s'assurer que le state est bien réinitialisé
      setTimeout(() => {
        if (activeTab === 'products') {
          loadProducts(0, false);
        } else if (activeTab === 'ingredients') {
          loadIngredients();
        } else if (activeTab === 'recipes') {
          loadRecipes();
        } else if (activeTab === 'scraping') {
          loadPromoStatus();
        }
      }, 100);
    }, [activeTab])
  );

  const loadProducts = async (page = 0, append = false) => {
    console.log(`[loadProducts] Chargement page ${page}, append=${append}`);
    setLoadingProducts(true);
    try {
      // Requête optimisée: charger uniquement les infos de base sans les prix
      const start = page * PRODUCTS_PER_PAGE;
      const end = start + PRODUCTS_PER_PAGE - 1;
      
      const { data, error } = await supabase
        .from('products')
        .select('id, name, brand, category, unit, image_url')
        .order('created_at', { ascending: false }) // Montrer les nouveaux produits en premier
        .range(start, end);

      if (error) throw error;
      
      const newProducts = data || [];
      console.log(`[loadProducts] ${newProducts.length} produits chargés`);
      if (newProducts.length > 0) {
        console.log(`[loadProducts] Premier produit: "${newProducts[0].name}"`);
      }
      setProducts(append ? [...products, ...newProducts] : newProducts);
      setHasMoreProducts(newProducts.length === PRODUCTS_PER_PAGE);
      setCurrentPage(page);
    } catch (error: any) {
      console.error('[loadProducts] Erreur:', error);
      Alert.alert('Erreur', error.message);
    } finally {
      setLoadingProducts(false);
    }
  };

  const loadMoreProducts = () => {
    if (!loadingProducts && hasMoreProducts) {
      loadProducts(currentPage + 1, true);
    }
  };

  const loadRecipes = async () => {
    setLoadingRecipes(true);
    try {
      const { data, error } = await supabase
        .from('recipes')
        .select('id, title, description, image, category, prep_time, servings, difficulty, tags')
        .order('title');

      if (error) throw error;
      setRecipes(data || []);
    } catch (error: any) {
      Alert.alert('Erreur', error.message);
    } finally {
      setLoadingRecipes(false);
    }
  };

  const loadIngredients = async () => {
    setLoadingIngredients(true);
    try {
      // Charger uniquement les produits utilisés dans des recettes EXISTANTES
      const { data, error } = await supabase
        .from('recipe_ingredients')
        .select(`
          product_id,
          products!inner(
            id,
            name,
            category,
            unit
          ),
          recipes!inner(id)
        `);

      if (error) throw error;

      // Extraire les produits uniques et compter les utilisations
      const productMap = new Map();
      (data || []).forEach((item: any) => {
        const product = item.products;
        if (product && product.id) {
          if (productMap.has(product.id)) {
            productMap.get(product.id).usageCount++;
          } else {
            productMap.set(product.id, {
              id: product.id,
              name: product.name,
              category: product.category,
              unit: product.unit,
              usageCount: 1,
            });
          }
        }
      });

      const ingredientsList = Array.from(productMap.values()).sort((a, b) => 
        a.name.localeCompare(b.name)
      );

      setIngredients(ingredientsList);
      console.log(`[Admin] ${ingredientsList.length} ingrédients chargés depuis des recettes actives`);
    } catch (error: any) {
      Alert.alert('Erreur', error.message);
    } finally {
      setLoadingIngredients(false);
    }
  };

  const handleCreateProduct = () => {
    setSelectedProductId(null);
    setProductModalVisible(true);
  };

  const handleEditProduct = (productId: string) => {
    setSelectedProductId(productId);
    setProductModalVisible(true);
  };

  const handleDeleteProduct = (productId: string, productName: string) => {
    Alert.alert(
      'Confirmer la suppression',
      `Supprimer "${productName}" et tous ses prix ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('products')
                .delete()
                .eq('id', productId);

              if (error) throw error;
              await loadProducts();
              Alert.alert('Succès', 'Produit supprimé');
            } catch (error: any) {
              Alert.alert('Erreur', error.message);
            }
          },
        },
      ]
    );
  };

  const handleCreateRecipe = () => {
    setSelectedRecipeId(null);
    setRecipeModalVisible(true);
  };

  const handleEditRecipe = (recipeId: string) => {
    setSelectedRecipeId(recipeId);
    setRecipeModalVisible(true);
  };

  const handleViewRecipeCost = (recipeId: string, recipeName: string) => {
    setSelectedRecipeForCost({ id: recipeId, name: recipeName });
    setRecipeCostModalVisible(true);
  };

  const handleDeleteRecipe = (recipeId: string, recipeTitle: string) => {
    Alert.alert(
      'Confirmer la suppression',
      `Supprimer "${recipeTitle}" et tous ses ingrédients ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('recipes')
                .delete()
                .eq('id', recipeId);

              if (error) throw error;
              await loadRecipes();
              Alert.alert('Succès', 'Recette supprimée');
            } catch (error: any) {
              Alert.alert('Erreur', error.message);
            }
          },
        },
      ]
    );
  };



  const loadPromoStatus = async () => {
    const status = await getPromotionsStatus();
    setPromoStatus(status);
    
    const byStore = await getPromotionsByStore();
    setPromosByStore(byStore);
  };



  const handleUpdateAllStores = async () => {
    setUpdatingAllStores(true);
    setLastScrapeSummary('');
    try {
      // Scraper tous les magasins en parallèle
      const stores = ['metro', 'iga', 'maxi', 'superc', 'walmart', 'loblaws', 'avril', 'rachelle'];
      const results = await Promise.allSettled(
        stores.map(store => 
          supabase.functions.invoke('scrape-reebee-flipp', {
            body: {
              postalCode: postalCode.replace(/\s/g, '') || 'H3A0G4',
              storeCode: store,
            },
          })
        )
      );

      let totalProducts = 0;
      let successCount = 0;
      const errors: string[] = [];

      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value.data) {
          totalProducts += result.value.data.data?.totalProducts || 0;
          successCount++;
        } else if (result.status === 'rejected') {
          errors.push(`${stores[index]}: ${result.reason}`);
        }
      });

      await loadPromoStatus();
      
      const summary = `${totalProducts} produits ajoutés • ${successCount}/${stores.length} magasin(s)`;
      setLastScrapeSummary(summary);
      
      if (errors.length > 0) {
        Alert.alert(
          'Scraping terminé avec erreurs',
          `${summary}\n\nErreurs:\n${errors.join('\n')}`
        );
      } else {
        Alert.alert('Succès', `${summary}\n\nToutes les promotions ont été scrapées!`);
      }
    } catch (error: any) {
      console.error('[ADMIN] Scraping error:', error);
      Alert.alert('Erreur', error.message || 'La mise à jour a échoué');
    } finally {
      setUpdatingAllStores(false);
    }
  };

  const handleUpdateSingleStore = async (storeCode: string) => {
    setScrapingStores(prev => new Set(prev).add(storeCode));
    try {
      const { data, error } = await supabase.functions.invoke('scrape-reebee-flipp', {
        body: {
          postalCode: postalCode.replace(/\s/g, '') || 'H3A0G4',
          storeCode,
        },
      });

      if (error) {
        throw new Error(error.message || `Erreur ${storeCode}`);
      }

      await loadPromoStatus();
      
      const totalProducts = data.data?.totalProducts || 0;
      Alert.alert('Succès', `${totalProducts} produits ajoutés pour ${storeCode.toUpperCase()}`);
    } catch (error: any) {
      Alert.alert('Erreur', error.message || `Le scraping de ${storeCode} a échoué`);
    } finally {
      setScrapingStores(prev => {
        const next = new Set(prev);
        next.delete(storeCode);
        return next;
      });
    }
  };

  const handleCleanupDuplicates = async () => {
    Alert.alert(
      'Confirmer',
      'Voulez-vous nettoyer automatiquement tous les produits en double ?\n\nCette action va fusionner les produits identiques et ne peut pas être annulée.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Nettoyer',
          onPress: async () => {
            setCleaningDuplicates(true);
            try {
              const result = await cleanupDuplicateProducts();
              if (result.success) {
                Alert.alert(
                  'Nettoyage terminé',
                  `${result.duplicatesRemoved} produit(s) en double supprimé(s)\n${result.groupsMerged} groupe(s) fusionné(s)`
                );
              } else {
                Alert.alert('Erreur', result.error || 'Le nettoyage a échoué');
              }
            } catch (error: any) {
              Alert.alert('Erreur', error.message || 'Le nettoyage a échoué');
            } finally {
              setCleaningDuplicates(false);
            }
          },
        },
      ]
    );
  };

  const handleClassifyProducts = async () => {
    Alert.alert(
      'Classification automatique',
      'Voulez-vous classifier automatiquement tous les produits sans catégorie via AI ?\n\nCela prendra quelques minutes selon le nombre de produits.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Classifier',
          onPress: async () => {
            setClassifyingProducts(true);
            setClassificationProgress(null);
            try {
              let totalProcessed = 0;
              let hasMore = true;
              let offset = 0;
              const batchSize = 100;

              while (hasMore) {
                const { data, error } = await supabase.functions.invoke('classify-products', {
                  body: { limit: batchSize, offset },
                });

                if (error) {
                  throw new Error(error.message || 'Erreur de classification');
                }

                totalProcessed += data.processed || 0;
                setClassificationProgress({
                  processed: totalProcessed,
                  total: totalProcessed + (data.remaining || 0),
                  remaining: data.remaining || 0,
                });

                hasMore = data.hasMore;
                offset += batchSize;

                // Petit délai entre les batches
                if (hasMore) {
                  await new Promise(resolve => setTimeout(resolve, 1000));
                }
              }

              Alert.alert(
                'Classification terminée !',
                `✅ ${totalProcessed} produit(s) classifié(s) avec succès\n\nLes filtres de catégories dans l'onglet Circulaire fonctionnent maintenant.`
              );
            } catch (error: any) {
              Alert.alert('Erreur', error.message || 'La classification a échoué');
            } finally {
              setClassifyingProducts(false);
              setClassificationProgress(null);
            }
          },
        },
      ]
    );
  };

  const handleScrapeGoogleShopping = async () => {
    Alert.alert(
      'Google Shopping (Rapide)',
      `Scraper automatiquement tous les ingrédients via Google Shopping ?\n\n✅ Rapide: ~${Math.ceil(ingredients.length / 6)} minute(s)\n✅ Fiable: IGA, Super C, Walmart, Avril, Rachelle\n❌ Limité: Metro et Maxi non disponibles`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Lancer',
          onPress: async () => {
            setScrapingGoogleShopping(true);
            setGoogleShoppingProgress(null);
            try {
              const result = await scrapeAllIngredientsWithGoogle(
                (progress) => {
                  setGoogleShoppingProgress(progress);
                },
                1 // Séquentiel pour éviter rate limiting
              );

              if (result.success) {
                Alert.alert(
                  'Scraping Google Shopping terminé !',
                  `✅ ${result.successfulIngredients}/${result.totalIngredients} ingrédient(s) scrapé(s)\n📦 ${result.totalPricesAdded} prix ajouté(s)${result.failedIngredients.length > 0 ? `\n\n⚠️ Échecs (${result.failedIngredients.length}):\n${result.failedIngredients.slice(0, 5).join('\n')}${result.failedIngredients.length > 5 ? `\n... et ${result.failedIngredients.length - 5} autre(s)` : ''}` : ''}`,
                  [
                    {
                      text: 'OK',
                      onPress: () => loadIngredients(),
                    },
                  ]
                );
              } else {
                Alert.alert('Erreur', result.error || 'Le scraping a échoué');
              }
            } catch (error: any) {
              Alert.alert('Erreur', error.message || 'Le scraping a échoué');
            } finally {
              setScrapingGoogleShopping(false);
              setGoogleShoppingProgress(null);
            }
          },
        },
      ]
    );
  };

  const handleScrapeFirecrawl = async () => {
    Alert.alert(
      'Firecrawl (Complet mais lent)',
      `Scraper tous les ingrédients via Firecrawl (scraping direct) ?\n\n✅ Complet: Tous les magasins (Metro, Maxi, IGA, Super C, Walmart)\n⚠️ Lent: ~${Math.ceil(ingredients.length * 2)} minute(s) (2 magasins par défaut)\n⚠️ Risqué: Timeouts possibles sur sites JS-heavy\n\nMagasins: Metro + Maxi`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Lancer',
          onPress: async () => {
            setScrapingFirecrawl(true);
            setFirecrawlProgress(null);
            try {
              const result = await scrapeAllIngredientsWithFirecrawl(
                (progress) => {
                  setFirecrawlProgress(progress);
                },
                ['metro', 'maxi'] // Magasins par défaut
              );

              if (result.success) {
                Alert.alert(
                  'Scraping Firecrawl terminé !',
                  `✅ ${result.successfulIngredients}/${result.totalIngredients} ingrédient(s) scrapé(s)\n📦 ${result.totalPricesAdded} prix ajouté(s)${result.failedIngredients.length > 0 ? `\n\n⚠️ Échecs (${result.failedIngredients.length}):\n${result.failedIngredients.slice(0, 3).join('\n')}${result.failedIngredients.length > 3 ? `\n... et ${result.failedIngredients.length - 3} autre(s)` : ''}` : ''}`,
                  [
                    {
                      text: 'OK',
                      onPress: () => loadIngredients(),
                    },
                  ]
                );
              } else {
                Alert.alert('Erreur', result.error || 'Le scraping a échoué');
              }
            } catch (error: any) {
              Alert.alert('Erreur', error.message || 'Le scraping a échoué');
            } finally {
              setScrapingFirecrawl(false);
              setFirecrawlProgress(null);
            }
          },
        },
      ]
    );
  };

  const handleScrapeAllIngredients = async () => {
    Alert.alert(
      'Scraper tous les ingrédients',
      `Voulez-vous scraper automatiquement tous les ingrédients utilisés dans vos recettes via Google Shopping ?\n\nCela prendra environ ${ingredients.length} minute(s).`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Lancer',
          onPress: async () => {
            setScrapingAllIngredients(true);
            setBulkScrapingProgress(null);
            try {
              const result = await scrapeAllIngredients(
                (progress) => {
                  setBulkScrapingProgress(progress);
                },
                'google-shopping', // Méthode recommandée
                1 // Scraping séquentiel pour éviter rate limiting
              );

              if (result.success) {
                Alert.alert(
                  'Scraping terminé !',
                  `✅ ${result.successfulIngredients}/${result.totalIngredients} ingrédient(s) scrapé(s)\n📦 ${result.totalPricesAdded} prix ajouté(s)${result.failedIngredients.length > 0 ? `\n\n⚠️ Échecs (${result.failedIngredients.length}):\n${result.failedIngredients.slice(0, 5).join('\n')}${result.failedIngredients.length > 5 ? `\n... et ${result.failedIngredients.length - 5} autre(s)` : ''}` : ''}`
                );
              } else {
                Alert.alert('Erreur', result.error || 'Le scraping a échoué');
              }
            } catch (error: any) {
              Alert.alert('Erreur', error.message || 'Le scraping a échoué');
            } finally {
              setScrapingAllIngredients(false);
              setBulkScrapingProgress(null);
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Jamais';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'À l\'instant';
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    if (diffDays < 7) return `Il y a ${diffDays}j`;
    
    return date.toLocaleDateString('fr-CA', { 
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const renderTabContent = () => {
    if (activeTab === 'products') {
      const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
      );

      return (
        <View style={styles.tabContent}>
          <View style={styles.productsHeader}>
            <TextInput
              style={styles.searchInput}
              placeholder="Rechercher un produit..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor={colors.textSecondary}
            />
            <Pressable
              style={styles.refreshButton}
              onPress={() => {
                setSearchQuery('');
                setProducts([]);
                loadProducts(0, false);
              }}
            >
              <MaterialIcons name="refresh" size={20} color={colors.accent} />
            </Pressable>
            <Pressable
              style={styles.createButton}
              onPress={handleCreateProduct}
            >
              <MaterialIcons name="add" size={20} color={colors.surface} />
              <Text style={styles.createButtonText}>Créer</Text>
            </Pressable>
          </View>

          {loadingProducts && currentPage === 0 ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingBottom: 100 }}
              onScroll={(e) => {
                const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
                const isCloseToBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 100;
                if (isCloseToBottom && !searchQuery) {
                  loadMoreProducts();
                }
              }}
              scrollEventThrottle={400}
            >
              {filteredProducts.map((product) => (
                <View key={product.id} style={styles.productCard}>
                  <View style={styles.productCardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.productName}>{product.name}</Text>
                      {product.brand && (
                        <Text style={styles.productBrand}>{product.brand}</Text>
                      )}
                      <Text style={styles.productCategory}>
                        {product.category || 'Sans catégorie'} • {product.unit}
                      </Text>
                    </View>
                    <View style={styles.productActions}>
                      <Pressable
                        style={styles.productActionButton}
                        onPress={() => handleEditProduct(product.id)}
                      >
                        <MaterialIcons name="edit" size={20} color={colors.primary} />
                      </Pressable>
                      <Pressable
                        style={styles.productActionButton}
                        onPress={() => handleDeleteProduct(product.id, product.name)}
                      >
                        <MaterialIcons name="delete" size={20} color={colors.error} />
                      </Pressable>
                    </View>
                  </View>
                </View>
              ))}
              {filteredProducts.length === 0 && !loadingProducts && (
                <View style={styles.emptyState}>
                  <MaterialIcons name="inventory-2" size={48} color={colors.textSecondary} />
                  <Text style={styles.emptyStateText}>
                    {searchQuery ? 'Aucun produit trouvé' : 'Aucun produit'}
                  </Text>
                </View>
              )}
              {loadingProducts && currentPage > 0 && (
                <View style={styles.loadingMore}>
                  <ActivityIndicator color={colors.primary} />
                  <Text style={styles.loadingMoreText}>Chargement...</Text>
                </View>
              )}
            </ScrollView>
          )}
        </View>
      );
    }

    if (activeTab === 'recipes') {
      const filteredRecipes = recipes.filter(r =>
        r.title.toLowerCase().includes(recipeSearchQuery.toLowerCase())
      );

      return (
        <View style={styles.tabContent}>
          <View style={styles.recipesHeader}>
            <TextInput
              style={styles.searchInput}
              placeholder="Rechercher une recette..."
              value={recipeSearchQuery}
              onChangeText={setRecipeSearchQuery}
              placeholderTextColor={colors.textSecondary}
            />
            <Pressable
              style={styles.createButton}
              onPress={handleCreateRecipe}
            >
              <MaterialIcons name="add" size={20} color={colors.surface} />
              <Text style={styles.createButtonText}>Créer</Text>
            </Pressable>
          </View>

          {loadingRecipes ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingBottom: 100 }}
            >
              {filteredRecipes.map((recipe) => (
                <View key={recipe.id} style={styles.recipeCard}>
                  {recipe.image && recipe.image.startsWith('http') && (
                    <View style={styles.recipeImageContainer}>
                      <Image
                        source={{ uri: recipe.image }}
                        style={styles.recipeImage}
                      />
                    </View>
                  )}
                  <Pressable
                    style={styles.recipeCardContent}
                    onPress={() => router.push(`/recipe/${recipe.id}`)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.recipeName}>{recipe.title}</Text>
                      {recipe.description && (
                        <Text style={styles.recipeDescription} numberOfLines={2}>
                          {recipe.description}
                        </Text>
                      )}
                      <View style={styles.recipeMetaRow}>
                        {recipe.category && (
                          <Text style={styles.recipeCategory}>
                            {recipe.category}
                          </Text>
                        )}
                        {recipe.prep_time && (
                          <Text style={styles.recipeMeta}>
                            ⏱️ {recipe.prep_time} min
                          </Text>
                        )}
                        {recipe.servings && (
                          <Text style={styles.recipeMeta}>
                            👥 {recipe.servings}
                          </Text>
                        )}
                      </View>
                    </View>
                    <MaterialIcons name="chevron-right" size={24} color={colors.textSecondary} />
                  </Pressable>
                  <View style={styles.recipeActions}>
                    <Pressable
                      style={styles.recipeActionButton}
                      onPress={() => handleViewRecipeCost(recipe.id, recipe.title)}
                    >
                      <MaterialIcons name="attach-money" size={20} color={colors.success} />
                    </Pressable>
                    <Pressable
                      style={styles.recipeActionButton}
                      onPress={() => handleEditRecipe(recipe.id)}
                    >
                      <MaterialIcons name="edit" size={20} color={colors.primary} />
                    </Pressable>
                    <Pressable
                      style={styles.recipeActionButton}
                      onPress={() => handleDeleteRecipe(recipe.id, recipe.title)}
                    >
                      <MaterialIcons name="delete" size={20} color={colors.error} />
                    </Pressable>
                  </View>
                </View>
              ))}
              {filteredRecipes.length === 0 && !loadingRecipes && (
                <View style={styles.emptyState}>
                  <MaterialIcons name="restaurant-menu" size={48} color={colors.textSecondary} />
                  <Text style={styles.emptyStateText}>
                    {recipeSearchQuery ? 'Aucune recette trouvée' : 'Aucune recette'}
                  </Text>
                </View>
              )}
            </ScrollView>
          )}
        </View>
      );
    }

    if (activeTab === 'ingredients') {
      const filteredIngredients = ingredients.filter(i =>
        i.name.toLowerCase().includes(ingredientSearchQuery.toLowerCase())
      );

      return (
        <View style={styles.tabContent}>
          <View style={styles.ingredientsHeader}>
            <TextInput
              style={styles.searchInput}
              placeholder="Rechercher un ingrédient..."
              value={ingredientSearchQuery}
              onChangeText={setIngredientSearchQuery}
              placeholderTextColor={colors.textSecondary}
            />
          </View>

          {loadingIngredients ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingBottom: 100 }}
            >
              {filteredIngredients.map((ingredient) => (
                <Pressable
                  key={ingredient.id}
                  style={styles.ingredientCard}
                  onPress={() => router.push(`/ingredient/${ingredient.id}`)}
                >
                  <View style={styles.ingredientCardContent}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.ingredientName}>{ingredient.name}</Text>
                      <Text style={styles.ingredientCategory}>
                        {ingredient.category || 'Sans catégorie'} • {ingredient.unit}
                      </Text>
                      <Text style={styles.ingredientUsage}>
                        Utilisé dans {ingredient.usageCount} recette{ingredient.usageCount > 1 ? 's' : ''}
                      </Text>
                    </View>
                    <MaterialIcons name="chevron-right" size={24} color={colors.textSecondary} />
                  </View>
                </Pressable>
              ))}
              {filteredIngredients.length === 0 && !loadingIngredients && (
                <View style={styles.emptyState}>
                  <MaterialIcons name="category" size={48} color={colors.textSecondary} />
                  <Text style={styles.emptyStateText}>
                    {ingredientSearchQuery ? 'Aucun ingrédient trouvé' : 'Aucun ingrédient'}
                  </Text>
                </View>
              )}
            </ScrollView>
          )}
        </View>
      );
    }

    if (activeTab === 'scraping') {
      return (
        <ScrollView 
          style={styles.tabContent}
          contentContainerStyle={{ paddingBottom: 100 }}
        >
          <Text style={styles.sectionTitle}>Configuration du scraping</Text>

          <View style={styles.formSection}>
            <Text style={styles.label}>Code postal (Québec)</Text>
            <TextInput
              style={styles.input}
              placeholder="H3A 0G4"
              value={postalCode}
              onChangeText={setPostalCode}
              autoCapitalize="characters"
              maxLength={7}
            />
            <Text style={styles.helperText}>
              Requis pour le scraping des circulaires Flipp
            </Text>
          </View>

          <View style={styles.divider} />

          {/* Statut des promotions */}
          {promoStatus ? (
            <View style={[styles.infoBox, { borderColor: colors.success, marginBottom: spacing.lg }]}>
              <MaterialIcons name="info" size={20} color={colors.success} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.infoBoxText, { fontWeight: '600', color: colors.success }]}>
                  📊 Statut actuel
                </Text>
                <Text style={styles.infoBoxText}>
                  {promoStatus.activePromotions} promotions actives{'\n'}
                  Dernier scraping: {formatDate(promoStatus.lastScrapeDate)}
                </Text>
                {lastScrapeSummary ? (
                  <Text style={[styles.infoBoxText, { marginTop: spacing.xs, fontWeight: '600' }]}>
                    Dernière mise à jour: {lastScrapeSummary}
                  </Text>
                ) : null}
              </View>
            </View>
          ) : null}

          {/* Mise à jour automatique hebdomadaire */}
          <View style={styles.scrapingSection}>
            <View style={styles.scrapingSectionHeader}>
              <MaterialIcons name="event-repeat" size={24} color={colors.warning} />
              <Text style={styles.scrapingSectionTitle}>Mise à jour automatique hebdomadaire</Text>
            </View>
            
            <View style={[styles.infoBox, { borderColor: colors.success, marginBottom: spacing.md }]}>
              <MaterialIcons name="check-circle" size={20} color={colors.success} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.infoBoxText, { fontWeight: '600', color: colors.success }]}>
                  ✅ API Flipp restaurée et fonctionnelle !
                </Text>
                <Text style={styles.infoBoxText}>
                  L'API Flipp (flyers-ng.flippback.com) est opérationnelle. Le scraping automatique des promotions hebdomadaires fonctionne pour Metro, IGA, Maxi, Super C, Walmart, Avril et tous les autres magasins d'épicerie québécois.
                </Text>
              </View>
            </View>

            <Pressable
              style={[styles.scrapeButton, { backgroundColor: colors.primary }, updatingAllStores && styles.scrapeButtonDisabled]}
              onPress={handleUpdateAllStores}
              disabled={updatingAllStores}
            >
              {updatingAllStores ? (
                <ActivityIndicator color={colors.surface} />
              ) : (
                <>
                  <MaterialIcons name="sync" size={24} color={colors.surface} />
                  <Text style={styles.scrapeButtonText}>Actualiser toutes les promotions maintenant</Text>
                </>
              )}
            </Pressable>

            {/* Scraping individuel par magasin */}
            <View style={styles.individualScrapingSection}>
              <View style={styles.scrapingSectionHeader}>
                <MaterialIcons name="store" size={24} color={colors.accent} />
                <Text style={styles.scrapingSectionTitle}>Scraping par magasin</Text>
              </View>
              <Text style={styles.infoText}>Actualiser les promotions d'un magasin spécifique</Text>
              
              {promosByStore.map((store) => {
                const isScrapingThisStore = scrapingStores.has(store.storeCode);
                return (
                  <View key={store.storeCode} style={styles.storeScrapRow}>
                    <View style={styles.storeInfo}>
                      <Text style={styles.storeName}>{store.storeName}</Text>
                      <Text style={styles.storePromoCount}>{store.promotionCount} promos</Text>
                    </View>
                    <Pressable
                      style={[styles.storeScrapButton, isScrapingThisStore && styles.storeScrapButtonDisabled]}
                      onPress={() => handleUpdateSingleStore(store.storeCode)}
                      disabled={isScrapingThisStore}
                    >
                      {isScrapingThisStore ? (
                        <ActivityIndicator size="small" color={colors.surface} />
                      ) : (
                        <MaterialIcons name="refresh" size={20} color={colors.surface} />
                      )}
                    </Pressable>
                  </View>
                );
              })}
            </View>

            <View style={[styles.infoBox, { borderColor: colors.accent, marginTop: spacing.md }]}>
              <MaterialIcons name="schedule" size={20} color={colors.accent} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.infoBoxText, { fontWeight: '600', color: colors.accent }]}>
                  ⏰ Automatisation via CRON (chaque jeudi 1h)
                </Text>
                <Text style={styles.infoBoxText}>
                  Pour automatiser cette mise à jour hebdomadaire:{"\n"}
                  {"\n"}1. Créez un compte gratuit sur cron-job.org{"\n"}
                  2. Créez un nouveau cronjob avec:{"\n"}
                  {"   "}• URL: https://jvmqoplyrhzpmhydjvmq.backend.onspace.ai/functions/v1/scrape-reebee-flipp{"\n"}
                  {"   "}• Méthode: POST{"\n"}
                  {"   "}• Headers: Authorization: Bearer [SUPABASE_SERVICE_ROLE_KEY]{"\n"}
                  {"   "}• Body: {`{"postalCode":"H3A0G4"}`}{"\n"}
                  {"   "}• Horaire: Chaque jeudi à 1h du matin{"\n"}
                  {"\n"}Ou utilisez GitHub Actions / Vercel Cron / Netlify Functions.
                </Text>
              </View>
            </View>
          </View>



          {/* Scraping automatique Google Shopping (Rapide) */}
          <View style={styles.scrapingSection}>
            <View style={styles.scrapingSectionHeader}>
              <MaterialIcons name="shopping-cart" size={24} color={colors.success} />
              <Text style={styles.scrapingSectionTitle}>Google Shopping (Rapide)</Text>
            </View>
            <Text style={styles.infoText}>
              ✅ <Text style={{ fontWeight: '700' }}>Rapide</Text>: ~{Math.ceil(ingredients.length / 6)} minute(s) pour {ingredients.length} ingrédient(s){"\n"}
              ✅ <Text style={{ fontWeight: '700' }}>Fiable</Text>: IGA, Super C, Walmart, Avril, Rachelle Béry{"\n"}
              ❌ <Text style={{ fontWeight: '700' }}>Limité</Text>: Metro et Maxi non disponibles sur Google Shopping
            </Text>

            {scrapingGoogleShopping && googleShoppingProgress && (
              <View style={styles.bulkProgressBox}>
                <View style={styles.bulkProgressHeader}>
                  <ActivityIndicator size="small" color={colors.success} />
                  <Text style={styles.bulkProgressTitle}>
                    {googleShoppingProgress.completedIngredients}/{googleShoppingProgress.totalIngredients} ingrédients scrapés
                  </Text>
                </View>
                {googleShoppingProgress.phaseProgress && (
                  <View style={styles.bulkProgressPhaseRow}>
                    <MaterialIcons name="shopping-cart" size={16} color={colors.success} />
                    <Text style={styles.bulkProgressPhase}>
                      {googleShoppingProgress.phaseProgress}
                    </Text>
                  </View>
                )}
                <Text style={styles.bulkProgressCurrent}>
                  En cours: {googleShoppingProgress.currentIngredient}
                </Text>
                {googleShoppingProgress.currentIngredientProgress && (
                  <Text style={styles.bulkProgressDetail}>
                    {googleShoppingProgress.currentIngredientProgress.totalProducts} produit(s) trouvé(s)
                  </Text>
                )}
                <Text style={styles.bulkProgressStats}>
                  📦 {googleShoppingProgress.totalPricesAdded} prix ajoutés • ❌ {googleShoppingProgress.failedIngredients.length} échecs
                </Text>
              </View>
            )}

            <Pressable
              style={[styles.scrapeButton, { backgroundColor: colors.success }, scrapingGoogleShopping && styles.scrapeButtonDisabled]}
              onPress={handleScrapeGoogleShopping}
              disabled={scrapingGoogleShopping}
            >
              {scrapingGoogleShopping ? (
                <ActivityIndicator color={colors.surface} />
              ) : (
                <>
                  <MaterialIcons name="shopping-cart" size={24} color={colors.surface} />
                  <Text style={styles.scrapeButtonText}>Scraper avec Google Shopping ({ingredients.length})</Text>
                </>
              )}
            </Pressable>
          </View>

          {/* Scraping automatique Firecrawl (Complet mais lent) */}
          <View style={styles.scrapingSection}>
            <View style={styles.scrapingSectionHeader}>
              <MaterialIcons name="cloud-download" size={24} color={colors.accent} />
              <Text style={styles.scrapingSectionTitle}>Firecrawl Direct (Complet mais lent)</Text>
            </View>
            <Text style={styles.infoText}>
              ✅ <Text style={{ fontWeight: '700' }}>Complet</Text>: Tous les magasins (Metro, Maxi, IGA, Super C, Walmart){"\n"}
              ⚠️ <Text style={{ fontWeight: '700' }}>Lent</Text>: ~{Math.ceil(ingredients.length * 2)} minute(s) avec Metro + Maxi{"\n"}
              ⚠️ <Text style={{ fontWeight: '700' }}>Risqué</Text>: Timeouts possibles sur sites JavaScript-heavy (Walmart, IGA)
            </Text>

            <View style={[styles.infoBox, { borderColor: colors.warning, marginBottom: spacing.md }]}>
              <MaterialIcons name="info" size={20} color={colors.warning} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.infoBoxText, { fontWeight: '600', color: colors.warning }]}>
                  ⚠️ Scraping direct des sites web
                </Text>
                <Text style={styles.infoBoxText}>
                  Firecrawl analyse les sites des épiceries via JavaScript. Plus complet mais plus lent et sensible aux changements de structure HTML. Recommandé pour compléter Metro et Maxi après Google Shopping.
                </Text>
              </View>
            </View>

            {scrapingFirecrawl && firecrawlProgress && (
              <View style={[styles.bulkProgressBox, { borderColor: colors.accent }]}>
                <View style={styles.bulkProgressHeader}>
                  <ActivityIndicator size="small" color={colors.accent} />
                  <Text style={styles.bulkProgressTitle}>
                    {firecrawlProgress.completedIngredients}/{firecrawlProgress.totalIngredients} ingrédients scrapés
                  </Text>
                </View>
                {firecrawlProgress.phaseProgress && (
                  <View style={styles.bulkProgressPhaseRow}>
                    <MaterialIcons name="cloud-download" size={16} color={colors.accent} />
                    <Text style={[styles.bulkProgressPhase, { color: colors.accent }]}>
                      {firecrawlProgress.phaseProgress}
                    </Text>
                  </View>
                )}
                <Text style={styles.bulkProgressCurrent}>
                  En cours: {firecrawlProgress.currentIngredient}
                </Text>
                <Text style={styles.bulkProgressStats}>
                  📦 {firecrawlProgress.totalPricesAdded} prix ajoutés • ❌ {firecrawlProgress.failedIngredients.length} échecs
                </Text>
              </View>
            )}

            <Pressable
              style={[styles.scrapeButton, { backgroundColor: colors.accent }, scrapingFirecrawl && styles.scrapeButtonDisabled]}
              onPress={handleScrapeFirecrawl}
              disabled={scrapingFirecrawl}
            >
              {scrapingFirecrawl ? (
                <ActivityIndicator color={colors.surface} />
              ) : (
                <>
                  <MaterialIcons name="cloud-download" size={24} color={colors.surface} />
                  <Text style={styles.scrapeButtonText}>Scraper avec Firecrawl ({ingredients.length})</Text>
                </>
              )}
            </Pressable>
          </View>

          {/* Classification AI des produits */}
          <View style={styles.scrapingSection}>
            <View style={styles.scrapingSectionHeader}>
              <MaterialIcons name="category" size={24} color={colors.success} />
              <Text style={styles.scrapingSectionTitle}>Classification AI (Catégories)</Text>
            </View>
            <Text style={styles.infoText}>
              Classifier automatiquement tous les produits sans catégorie via OnSpace AI. Cette opération permet aux filtres de l'onglet Circulaire de fonctionner correctement.
            </Text>

            <View style={[styles.infoBox, { borderColor: colors.success, marginBottom: spacing.md }]}>              <MaterialIcons name="info" size={20} color={colors.success} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.infoBoxText, { fontWeight: '600', color: colors.success }]}>
                  🤖 Catégories détectées par AI
                </Text>
                <Text style={styles.infoBoxText}>
                  L'AI classifie chaque produit dans une catégorie : Viandes, Poissons et fruits de mer, Légumes, Fruits, Produits laitiers, Garde-manger, Boissons, Boulangerie, Surgelés, Hygiène et beauté, Entretien ménager.
                </Text>
              </View>
            </View>

            {classifyingProducts && classificationProgress && (
              <View style={styles.bulkProgressBox}>
                <View style={styles.bulkProgressHeader}>
                  <ActivityIndicator size="small" color={colors.success} />
                  <Text style={styles.bulkProgressTitle}>
                    {classificationProgress.processed}/{classificationProgress.total} produits classifiés
                  </Text>
                </View>
                <Text style={styles.bulkProgressCurrent}>
                  Encore {classificationProgress.remaining} produits à traiter...
                </Text>
              </View>
            )}

            <Pressable
              style={[styles.scrapeButton, { backgroundColor: colors.success }, classifyingProducts && styles.scrapeButtonDisabled]}
              onPress={handleClassifyProducts}
              disabled={classifyingProducts}
            >
              {classifyingProducts ? (
                <ActivityIndicator color={colors.surface} />
              ) : (
                <>
                  <MaterialIcons name="category" size={24} color={colors.surface} />
                  <Text style={styles.scrapeButtonText}>Classifier tous les produits</Text>
                </>
              )}
            </Pressable>
          </View>

          {/* Nettoyage des doublons */}
          <View style={styles.scrapingSection}>
            <View style={styles.scrapingSectionHeader}>
              <MaterialIcons name="cleaning-services" size={24} color={colors.warning} />
              <Text style={styles.scrapingSectionTitle}>Nettoyage des doublons</Text>
            </View>
            <Text style={styles.infoText}>
              Fusionner automatiquement les produits en double détectés par fuzzy matching. Cette action ne peut pas être annulée.
            </Text>

            <Pressable
              style={[styles.scrapeButton, { backgroundColor: colors.warning }, cleaningDuplicates && styles.scrapeButtonDisabled]}
              onPress={handleCleanupDuplicates}
              disabled={cleaningDuplicates}
            >
              {cleaningDuplicates ? (
                <ActivityIndicator color={colors.surface} />
              ) : (
                <>
                  <MaterialIcons name="auto-fix-high" size={24} color={colors.surface} />
                  <Text style={styles.scrapeButtonText}>Nettoyer les doublons</Text>
                </>
              )}
            </Pressable>
          </View>
        </ScrollView>
      );
    }

    return null;
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>Admin</Text>
          <Text style={styles.subtitle}>Gestion des recettes et prix</Text>
        </View>
        <Pressable
          style={styles.scraperButton}
          onPress={() => router.push('/admin-scraper')}
        >
          <MaterialIcons name="cloud-download" size={20} color={colors.surface} />
          <Text style={styles.scraperButtonText}>Scraper URL</Text>
        </Pressable>
      </View>

      <View style={styles.tabBar}>
        <Pressable
          style={[styles.tab, activeTab === 'recipes' && styles.tabActive]}
          onPress={() => setActiveTab('recipes')}
        >
          <MaterialIcons
            name="restaurant-menu"
            size={20}
            color={activeTab === 'recipes' ? colors.primary : colors.textSecondary}
          />
          <Text
            style={[
              styles.tabText,
              activeTab === 'recipes' && styles.tabTextActive,
            ]}
          >
            Recettes
          </Text>
        </Pressable>

        <Pressable
          style={[styles.tab, activeTab === 'products' && styles.tabActive]}
          onPress={() => setActiveTab('products')}
        >
          <MaterialIcons
            name="inventory"
            size={20}
            color={activeTab === 'products' ? colors.primary : colors.textSecondary}
          />
          <Text
            style={[
              styles.tabText,
              activeTab === 'products' && styles.tabTextActive,
            ]}
          >
            Produits
          </Text>
        </Pressable>

        <Pressable
          style={[styles.tab, activeTab === 'ingredients' && styles.tabActive]}
          onPress={() => setActiveTab('ingredients')}
        >
          <MaterialIcons
            name="category"
            size={20}
            color={activeTab === 'ingredients' ? colors.primary : colors.textSecondary}
          />
          <Text
            style={[
              styles.tabText,
              activeTab === 'ingredients' && styles.tabTextActive,
            ]}
          >
            Ingrédients
          </Text>
        </Pressable>

        <Pressable
          style={[styles.tab, activeTab === 'scraping' && styles.tabActive]}
          onPress={() => setActiveTab('scraping')}
        >
          <MaterialIcons
            name="sync"
            size={20}
            color={activeTab === 'scraping' ? colors.primary : colors.textSecondary}
          />
          <Text
            style={[
              styles.tabText,
              activeTab === 'scraping' && styles.tabTextActive,
            ]}
          >
            Scraping
          </Text>
        </Pressable>
      </View>

      <View style={styles.content}>{renderTabContent()}</View>

      <ProductManagementModal
        visible={productModalVisible}
        productId={selectedProductId}
        onClose={() => setProductModalVisible(false)}
        onSave={loadProducts}
      />

      <RecipeManagementModal
        visible={recipeModalVisible}
        recipeId={selectedRecipeId}
        onClose={() => setRecipeModalVisible(false)}
        onSave={loadRecipes}
      />

      <RecipeCostDetailModal
        visible={recipeCostModalVisible}
        recipeId={selectedRecipeForCost?.id || null}
        recipeName={selectedRecipeForCost?.name || ''}
        onClose={() => setRecipeCostModalVisible(false)}
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
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: {
    flex: 1,
  },
  scraperButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  scraperButtonText: {
    ...typography.caption,
    color: colors.surface,
    fontWeight: '600',
  },
  title: {
    ...typography.h1,
    color: colors.text,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 4,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    gap: spacing.xs,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: colors.primary,
  },
  tabText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  tabTextActive: {
    ...typography.captionBold,
    color: colors.primary,
  },
  content: {
    flex: 1,
  },
  tabContent: {
    flex: 1,
    padding: spacing.md,
  },
  sectionTitle: {
    ...typography.h2,
    color: colors.text,
    marginBottom: spacing.md,
  },
  infoText: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  formSection: {
    marginBottom: spacing.md,
  },
  label: {
    ...typography.bodyBold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    ...typography.body,
    color: colors.text,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.lg,
  },
  scrapingSection: {
    marginBottom: spacing.lg,
  },
  scrapingSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  scrapingSectionTitle: {
    ...typography.h3,
    color: colors.text,
  },
  scrapeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  scrapeButtonDisabled: {
    opacity: 0.6,
  },
  scrapeButtonText: {
    ...typography.bodyBold,
    color: colors.surface,
  },
  helperText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 4,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  infoBoxText: {
    ...typography.caption,
    color: colors.text,
    flex: 1,
    lineHeight: 18,
  },
  promoStatsSection: {
    marginTop: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  promoStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  promoStatStore: {
    ...typography.body,
    color: colors.text,
  },
  promoStatCount: {
    ...typography.bodyBold,
    color: colors.success,
  },
  individualScrapingSection: {
    marginTop: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  storeScrapRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  storeInfo: {
    flex: 1,
  },
  storeName: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  storePromoCount: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  storeScrapButton: {
    backgroundColor: colors.accent,
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storeScrapButtonDisabled: {
    opacity: 0.6,
  },
  productsHeader: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  refreshButton: {
    padding: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchInput: {
    flex: 1,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.body,
    color: colors.text,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  createButtonText: {
    ...typography.bodyBold,
    color: colors.surface,
  },
  productCard: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  productCardHeader: {
    flexDirection: 'row',
    padding: spacing.md,
    gap: spacing.md,
  },
  productName: {
    ...typography.bodyBold,
    color: colors.text,
    marginBottom: 2,
  },
  productBrand: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  productCategory: {
    ...typography.small,
    color: colors.textSecondary,
  },
  productActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  productActionButton: {
    padding: spacing.xs,
  },
  productPrices: {
    backgroundColor: colors.background,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  productPricesTitle: {
    ...typography.captionBold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  productPriceItem: {
    ...typography.small,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xxl * 2,
  },
  emptyStateText: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingMore: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  loadingMoreText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  ingredientsHeader: {
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  ingredientCard: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  ingredientCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.sm,
  },
  ingredientName: {
    ...typography.bodyBold,
    color: colors.text,
    marginBottom: 2,
  },
  ingredientCategory: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  ingredientUsage: {
    ...typography.small,
    color: colors.primary,
    fontWeight: '600',
  },
  recipesHeader: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  recipeCard: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  recipeActions: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: colors.background,
  },
  recipeActionButton: {
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surface,
  },
  recipeImageContainer: {
    width: '100%',
    height: 160,
    backgroundColor: colors.background,
  },
  recipeImage: {
    width: '100%',
    height: '100%',
  },
  recipeCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.sm,
  },
  recipeName: {
    ...typography.bodyBold,
    color: colors.text,
    marginBottom: 4,
  },
  recipeDescription: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: 8,
    lineHeight: 18,
  },
  recipeMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  recipeCategory: {
    ...typography.small,
    color: colors.primary,
    fontWeight: '600',
  },
  recipeMeta: {
    ...typography.small,
    color: colors.textSecondary,
  },
  bulkProgressBox: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  bulkProgressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  bulkProgressTitle: {
    ...typography.bodyBold,
    color: colors.text,
  },
  bulkProgressCurrent: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
  },
  bulkProgressDetail: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  bulkProgressStats: {
    ...typography.caption,
    color: colors.text,
    marginTop: spacing.xs,
  },
  bulkProgressPhaseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  bulkProgressPhase: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: '600',
  },
});
