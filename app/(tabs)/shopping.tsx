import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, SectionList, Pressable, Modal, TextInput, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Image, Animated, Linking, SectionListProps } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, spacing, typography, borderRadius, shadows, storeInfo } from '@/constants/theme';
import { useShoppingList } from '@/hooks/useShoppingList';
import { shoppingStorePreferencesService } from '@/services/shoppingStorePreferencesService';
import { ShoppingListItem } from '@/components/feature/ShoppingListItem';
import { MaterialIcons } from '@expo/vector-icons';
import { useSubscription } from '@/hooks/useSubscription';
import { useAlert } from '@/template';
import { productSelectionService, ProductWithPrice } from '@/services/productSelectionService';
import { ShoppingListItem as ShoppingListItemType, ShoppingListCategory } from '@/types';

const AnimatedSectionList = Animated.createAnimatedComponent(SectionList);

export default function ShoppingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isSubscribed, isTrial } = useSubscription();
  const { showAlert } = useAlert();
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const { items, totalPrice, uncheckedCount, toggleCheck, removeItem, clearChecked, clearAll, addItem, updateItem, refreshPrices, bestStoreForList } = useShoppingList();
  const hasUncheckedItems = uncheckedCount > 0;

  const scrollY = useRef(new Animated.Value(0)).current;
  const HEADER_HEIGHT = 200;
  const headerTranslateY = scrollY.interpolate({ inputRange: [0, HEADER_HEIGHT], outputRange: [0, -HEADER_HEIGHT], extrapolate: 'clamp' });

  const [selectedStores, setSelectedStores] = useState<string[]>([]);
  const [showStoreFilter, setShowStoreFilter] = useState(false);

  useEffect(() => {
    try {
      const stores = shoppingStorePreferencesService.getSelectedStores();
      setSelectedStores(stores);
      refreshPrices(stores);
    } catch (error) {
      setSelectedStores([]);
    }
  }, []);

  const handleToggleStore = async (storeCode: string) => {
    if (!storeCode || typeof storeCode !== 'string') return;
    try {
      const updated = shoppingStorePreferencesService.toggleStore(storeCode);
      if (!Array.isArray(updated)) return;
      setSelectedStores(updated);
      try { await refreshPrices(updated); } catch {}
    } catch {}
  };

  const groupedItems = React.useMemo(() => {
    if (!items || !Array.isArray(items)) return [];
    try {
      const categoryLabels: Record<ShoppingListCategory, string> = {
        produce: 'Fruits et Légumes', meat: 'Viandes', fish: 'Poissons et Fruits de mer',
        dairy: 'Produits Laitiers', pantry: 'Garde-Manger', frozen: 'Surgelés',
      };
      const categoryOrder: ShoppingListCategory[] = ['produce', 'meat', 'fish', 'dairy', 'pantry', 'frozen'];
      const grouped = items.reduce((acc, item) => {
        if (!item || typeof item !== 'object') return acc;
        const category = item.category || 'produce';
        if (!acc[category]) acc[category] = [];
        acc[category].push(item);
        return acc;
      }, {} as Record<ShoppingListCategory, ShoppingListItemType[]>);

      const uncheckedSections = categoryOrder
        .filter(category => grouped[category] && grouped[category].length > 0)
        .map(category => ({ title: categoryLabels[category], data: grouped[category].filter((i: ShoppingListItemType) => !i.checked), category }))
        .filter(section => section.data.length > 0);

      const checkedItems = items.filter(i => i.checked);
      const checkedSection = checkedItems.length > 0 ? [{ title: 'Cochés', data: checkedItems, category: 'checked' as any }] : [];
      return [...uncheckedSections, ...checkedSection];
    } catch (error) {
      return [];
    }
  }, [items]);

  const hasAccess = isSubscribed || isTrial;
  const [showAddModal, setShowAddModal] = useState(false);
  const [activeSelectionTab, setActiveSelectionTab] = useState<'suggested' | 'recent'>('recent');
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestedProducts, setSuggestedProducts] = useState<ProductWithPrice[]>([]);
  const [recentProducts, setRecentProducts] = useState<ProductWithPrice[]>([]);
  const [searchResults, setSearchResults] = useState<ProductWithPrice[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [productQuantities, setProductQuantities] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [addingProducts, setAddingProducts] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [appLoading, setAppLoading] = useState(false);

  if (appLoading) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={styles.container}>
          <Animated.View style={[styles.header, { paddingTop: insets.top + spacing.xl, zIndex: 20, transform: [{ translateY: headerTranslateY }] }]}>
            <Text style={styles.title}>Liste d'épicerie</Text>
          </Animated.View>
          <View style={styles.loadingContainer}><ActivityIndicator size="large" color={colors.primary} /></View>
        </View>
      </GestureHandlerRootView>
    );
  }

  const [showEditModal, setShowEditModal] = useState(false);
  const [editingItem, setEditingItem] = useState<ShoppingListItemType | null>(null);
  const [editName, setEditName] = useState('');
  const [editQuantity, setEditQuantity] = useState(0);
  const [editUnit, setEditUnit] = useState('unité');
  const [editCategory, setEditCategory] = useState<ShoppingListCategory>('produce');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [editNote, setEditNote] = useState('');
  const [editPhoto, setEditPhoto] = useState<string | undefined>(undefined);
  const searchInputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (showAddModal) { loadProducts(); setTimeout(() => searchInputRef.current?.focus(), 100); }
  }, [showAddModal]);

  useEffect(() => { productSelectionService.initialize(); productSelectionService.preloadProducts(); }, []);

  const filteredSuggestions = React.useMemo(() => {
    try {
      if (!searchQuery || !searchQuery.trim()) return suggestedProducts || [];
      if (!Array.isArray(suggestedProducts)) return [];
      const q = searchQuery.toLowerCase().trim();
      return suggestedProducts.filter(p => p && p.name && p.name.toLowerCase().includes(q));
    } catch { return []; }
  }, [searchQuery, suggestedProducts]);

  const filteredRecents = React.useMemo(() => {
    try {
      if (!searchQuery || !searchQuery.trim()) return recentProducts || [];
      if (!Array.isArray(recentProducts)) return [];
      const q = searchQuery.toLowerCase().trim();
      return recentProducts.filter(p => p && p.name && p.name.toLowerCase().includes(q));
    } catch { return []; }
  }, [searchQuery, recentProducts]);

  const getProductInList = (productId: string) => {
    try {
      if (!items || !Array.isArray(items) || !productId) return undefined;
      return items.find(item => item && item.id && item.id.startsWith(productId));
    } catch { return undefined; }
  };

  const loadProducts = async () => {
    setLoading(true); setLoadError(null);
    try {
      const [suggested, recent] = await Promise.all([productSelectionService.getSuggestedProducts(), productSelectionService.getRecentProducts()]);
      setSuggestedProducts(suggested); setRecentProducts(recent);
      if (suggested.length === 0 && recent.length === 0) setLoadError("Aucun ingrédient disponible.");
    } catch { setLoadError('Erreur lors du chargement des produits'); }
    finally { setLoading(false); }
  };

  const getCategoryFromProduct = (cat?: string): ShoppingListCategory => {
    const c = cat?.toLowerCase() || '';
    if (c.includes('viande')) return 'meat';
    if (c.includes('poisson') || c.includes('fruits de mer')) return 'fish';
    if (c.includes('laitier') || c.includes('fromage') || c.includes('produits laitiers')) return 'dairy';
    if (c.includes('légume') || c.includes('fruit')) return 'produce';
    if (c.includes('surgelé')) return 'frozen';
    return 'pantry';
  };

  const classifyProductWithAI = async (productName: string): Promise<ShoppingListCategory> => {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY || '', 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 50, messages: [{ role: 'user', content: `Classifie ce produit: "${productName}". Réponds UNIQUEMENT avec: meat, fish, dairy, produce, pantry, frozen` }] })
      });
      const data = await response.json();
      const result = data.content[0].text.trim().toLowerCase();
      const valid = ['meat', 'fish', 'dairy', 'produce', 'pantry', 'frozen'];
      return valid.includes(result) ? result as ShoppingListCategory : 'pantry';
    } catch { return 'pantry'; }
  };

  const handleProductClick = async (product: ProductWithPrice) => {
    try {
      const existingItem = getProductInList(product.id);
      if (existingItem) { removeItem(existingItem.id); }
      else {
        setShowAddModal(false); setSearchQuery('');
        let finalProduct = product;
        if (!product.bestStore) {
          const results = await productSelectionService.searchProducts(product.name);
          if (results.length > 0) finalProduct = { ...product, ...results[0], name: product.name };
        }
        await addItem({ id: `${finalProduct.id}-${Date.now()}-${Math.random()}`, name: finalProduct.name, quantity: '1', unit: finalProduct.unit || 'unité', price: finalProduct.bestPrice || 0, store: finalProduct.bestStore || '', checked: false, category: finalProduct.category ? getCategoryFromProduct(finalProduct.category) : await classifyProductWithAI(finalProduct.name) }, selectedStores);
        productSelectionService.markAsRecentlyUsed(product).then(async () => { const recent = await productSelectionService.getRecentProducts(); setRecentProducts(recent); }).catch(() => {});
      }
    } catch {}
  };

  const handleRemoveFromModal = async (product: ProductWithPrice) => {
    const existingItem = getProductInList(product.id);
    if (existingItem) removeItem(existingItem.id);
  };

  const handleAddSelectedProducts = async () => {
    if (addingProducts) return;
    setAddingProducts(true);
    try {
      if (searchQuery.trim() && selectedProducts.size === 0) {
        const matchingProducts = await productSelectionService.searchProducts(searchQuery.trim());
        if (matchingProducts.length > 0) {
          const product = matchingProducts[0];
          product.name = searchQuery.trim();
          await productSelectionService.markAsRecentlyUsed(product);
          await addItem({ id: `${product.id}-${Date.now()}-${Math.random()}`, name: product.name, quantity: '1', unit: product.unit, price: product.bestPrice || 0, store: product.bestStore || '', checked: false, category: product.category ? getCategoryFromProduct(product.category) : await classifyProductWithAI(product.name) }, selectedStores);
          const recent = await productSelectionService.getRecentProducts(); setRecentProducts(recent);
        } else {
          const searchRes = await productSelectionService.searchProducts(searchQuery.trim());
          const bestMatch = searchRes[0];
          const customProduct: ProductWithPrice = { id: bestMatch?.id || `custom-${Date.now()}-${Math.random()}`, name: searchQuery.trim(), category: bestMatch?.category, unit: bestMatch?.unit || 'unité', bestPrice: bestMatch?.bestPrice || 0, bestStore: bestMatch?.bestStore || '' };
          await productSelectionService.markAsRecentlyUsed(customProduct);
          await addItem({ id: customProduct.id, name: customProduct.name, quantity: '1', unit: customProduct.unit, price: 0, store: '', checked: false, category: await classifyProductWithAI(customProduct.name) }, selectedStores);
          const recent = await productSelectionService.getRecentProducts(); setRecentProducts(recent);
        }
        setSearchQuery(''); setShowAddModal(false); return;
      }
      if (selectedProducts.size > 0) {
        const productsToAdd = activeSelectionTab === 'suggested' ? filteredSuggestions.filter(p => selectedProducts.has(p.id)) : filteredRecents.filter(p => selectedProducts.has(p.id));
        for (const product of productsToAdd) {
          const quantity = productQuantities[product.id] || 1;
          let enrichedProduct = product;
          if (!product.bestStore) { const results = await productSelectionService.searchProducts(product.name); if (results.length > 0) enrichedProduct = { ...product, ...results[0] }; }
          await productSelectionService.markAsRecentlyUsed(enrichedProduct);
          await addItem({ id: `${enrichedProduct.id}-${Date.now()}-${Math.random()}`, name: enrichedProduct.name, quantity: quantity.toString(), unit: enrichedProduct.unit, price: enrichedProduct.bestPrice || 0, store: enrichedProduct.bestStore || '', checked: false, category: enrichedProduct.category ? getCategoryFromProduct(enrichedProduct.category) : await classifyProductWithAI(enrichedProduct.name) }, selectedStores);
        }
        const recent = await productSelectionService.getRecentProducts(); setRecentProducts(recent);
        setSelectedProducts(new Set()); setProductQuantities({}); setSearchQuery(''); setShowAddModal(false); return;
      }
      alert('Veuillez saisir un nom de produit ou sélectionner un produit de la liste');
    } catch {} finally { setAddingProducts(false); }
  };

  const handleOpenEditModal = (item: ShoppingListItemType) => {
    setEditingItem(item); setEditName(item.name); setEditQuantity(parseFloat(item.quantity.toString()) || 0);
    setEditUnit(item.unit); setEditCategory(item.category || 'produce'); setEditNote(item.note || ''); setEditPhoto(item.photo); setShowEditModal(true);
  };

  const handleSaveEdit = () => {
    if (!editingItem) return;
    updateItem(editingItem.id, { name: editName.trim() || editingItem.name, quantity: editQuantity.toString(), unit: editUnit, category: editCategory, note: editNote.trim(), photo: editPhoto });
    setShowEditModal(false); setEditingItem(null); setShowCategoryPicker(false);
  };

  const handleCancelEdit = () => { setShowEditModal(false); setEditingItem(null); setShowCategoryPicker(false); setEditNote(''); setEditPhoto(undefined); };
  const incrementEditQuantity = () => setEditQuantity(prev => prev + 1);
  const decrementEditQuantity = () => setEditQuantity(prev => Math.max(0, prev - 1));
  const availableUnits = ['g', 'kg', 'L', 'ml', 'unité', 'lb', 'oz', 'tasse', 'c. à soupe', 'c. à thé'];
  const categories: Array<{ key: ShoppingListCategory; label: string; icon: string; color: string }> = [
    { key: 'frozen', label: 'Congelé', icon: 'ac-unit', color: '#64B5F6' },
    { key: 'pantry', label: 'Garde-Manger', icon: 'kitchen', color: '#FF9800' },
    { key: 'produce', label: 'Fruits et Légumes', icon: 'eco', color: '#66BB6A' },
    { key: 'dairy', label: 'Produits laitiers', icon: 'local-drink', color: '#42A5F5' },
    { key: 'meat', label: 'Viandes', icon: 'restaurant', color: '#EF5350' },
    { key: 'fish', label: 'Poissons', icon: 'set-meal', color: '#26A69A' },
  ];
  const currentCategoryData = categories.find(c => c.key === editCategory) || categories[2];

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { alert('Permission requise'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [4, 3], quality: 0.8 });
    if (!result.canceled && result.assets[0]) setEditPhoto(result.assets[0].uri);
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { alert('Permission requise'); return; }
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [4, 3], quality: 0.8 });
    if (!result.canceled && result.assets[0]) setEditPhoto(result.assets[0].uri);
  };

  const handleSubscription = () => router.push('/subscription');

  if (!hasAccess) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={styles.container}>
          <Animated.View style={[styles.header, { paddingTop: insets.top + spacing.xl, zIndex: 20, transform: [{ translateY: headerTranslateY }] }]}>
            <Text style={styles.title}>Liste d'épicerie</Text>
            <Text style={styles.subtitle}>Organisez vos courses efficacement</Text>
          </Animated.View>
          <ScrollView style={styles.scrollView} contentContainerStyle={styles.lockedContentContainer} showsVerticalScrollIndicator={false}>
            <View style={styles.lockedContainer}>
              <MaterialIcons name="shopping-cart" size={80} color={colors.border} />
              <Text style={styles.lockedTitle}>L'abonnement te fait économiser plus</Text>
              <Text style={styles.lockedText}>Créez vos listes personnalisées, comparez les prix et économisez en moyenne de 1250$ par année!</Text>
              <View style={styles.pricingCard}>
                <Text style={styles.pricingPeriod}>Mensuel</Text><Text style={styles.pricingAmount}>5$ /mois</Text><Text style={styles.pricingTrial}>7 jours gratuits!</Text>
                <Pressable style={styles.pricingButton} onPress={() => handleSubscription('monthly')} disabled={subscriptionLoading}>
                  {subscriptionLoading ? <ActivityIndicator size="small" color={colors.text} /> : <Text style={styles.pricingButtonText}>Commencer l'essai gratuit</Text>}
                </Pressable>
              </View>
              <View style={[styles.pricingCard, styles.pricingCardPopular]}>
                <View style={styles.popularBadge}><Text style={styles.popularBadgeText}>+ populaire</Text></View>
                <Text style={styles.pricingPeriod}>Annuel</Text><Text style={styles.pricingAmount}>50$ /an</Text><Text style={styles.pricingTrial}>7 jours gratuits!</Text>
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
      </GestureHandlerRootView>
    );
  }

  const STORES = [
    { code: 'metro', label: 'METRO' }, { code: 'iga', label: 'IGA' },
    { code: 'superc', label: 'Super C' }, { code: 'maxi', label: 'MAXI' }, { code: 'walmart', label: 'Walmart' },
  ];

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.container}>
        <Animated.View style={[styles.header, { paddingTop: insets.top + spacing.xl, zIndex: 20, transform: [{ translateY: headerTranslateY }] }]}>
          <Text style={styles.title}>Liste d'épicerie</Text>
          <Text style={styles.subtitle}>Organisez vos courses efficacement</Text>

          <View style={styles.buttonsRow}>
            <Pressable onPress={() => router.push('/pantry')} style={({ pressed }) => [styles.pantryButton, pressed && { opacity: 0.8 }]}>
              <MaterialIcons name="kitchen" size={18} color={colors.primary} />
              <Text style={styles.pantryButtonText}>Mon garde-manger</Text>
              <MaterialIcons name="chevron-right" size={18} color={colors.primary} />
            </Pressable>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              {items.length > 0 && (
                <Pressable onPress={clearAll} style={({ pressed }) => [styles.iconRoundButton, pressed && { opacity: 0.7 }]}>
                  <MaterialIcons name="delete" size={20} color={colors.error} />
                </Pressable>
              )}
              <Pressable onPress={() => setShowStoreFilter(true)} style={({ pressed }) => [styles.iconRoundButton, pressed && { opacity: 0.7 }]}>
                <MaterialIcons name="tune" size={20} color={colors.primary} />
                {selectedStores.length > 0 && selectedStores.length < 5 && (
                  <View style={styles.filterBadge}><Text style={styles.filterBadgeText}>{selectedStores.length}</Text></View>
                )}
              </Pressable>
            </View>
          </View>

          {bestStoreForList && (
  <View style={styles.bestStoreCard}>
    <MaterialIcons name="star" size={20} color={colors.primary} />
    <Text style={styles.bestStoreCardText}>
      <Text style={styles.bestStoreCardName}>{storeInfo[bestStoreForList.storeCode]?.name}</Text>
      {' '}— L'épicerie la moins chère pour vos courses
    </Text>
  </View>
)}
        </Animated.View>

        <AnimatedSectionList
          sections={Array.isArray(groupedItems) ? groupedItems : []}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ShoppingListItem item={item} onToggleCheck={() => toggleCheck(item.id)} onRemove={() => removeItem(item.id)} onPress={() => handleOpenEditModal(item)} />
          )}
          renderSectionHeader={({ section }) => {
            const isFirstSection = groupedItems[0]?.title === section.title;
            return (
              <View style={[styles.sectionHeader, isFirstSection && styles.firstSectionHeader]}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                <View style={styles.sectionDivider} />
              </View>
            );
          }}
          contentContainerStyle={[styles.listContent, { paddingTop: HEADER_HEIGHT + spacing.md, paddingBottom: insets.bottom + 150 }]}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
          scrollEventThrottle={16}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialIcons name="shopping-cart" size={80} color={colors.textLight} />
              <Text style={styles.emptyText}>Votre liste est vide</Text>
              <Text style={styles.emptySubtext}>Ajoutez des ingrédients depuis les recettes ou utilisez le bouton +</Text>
            </View>
          }
        />

        <Pressable onPress={() => setShowAddModal(true)} style={({ pressed }) => [styles.fabButton, { bottom: insets.bottom + 120 }, pressed && { opacity: 0.9, transform: [{ scale: 0.95 }] }]}>
          <MaterialIcons name="add" size={32} color={colors.surface} />
        </Pressable>

        {/* Modal filtre épiceries */}
        <Modal visible={showStoreFilter} animationType="slide" transparent onRequestClose={() => setShowStoreFilter(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Prix de :</Text>
                <Pressable onPress={() => setShowStoreFilter(false)}>
                  <MaterialIcons name="close" size={24} color={colors.text} />
                </Pressable>
              </View>
              <View style={{ padding: spacing.lg, flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {STORES.map(store => {
                  const isSelected = selectedStores.includes(store.code);
                  return (
                    <Pressable key={store.code} onPress={() => handleToggleStore(store.code)} style={[styles.filterChip, isSelected && styles.filterChipActive]}>
                      <Text style={[styles.filterChipText, isSelected && styles.filterChipTextActive]}>{store.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Pressable style={styles.applyButton} onPress={() => setShowStoreFilter(false)}>
                <Text style={styles.applyButtonText}>Appliquer</Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        {/* Modal ajout produits */}
        <Modal visible={showAddModal} animationType="slide" transparent={false} onRequestClose={() => setShowAddModal(false)}>
          <View style={[styles.selectionModalContainer, { paddingTop: insets.top }]}>
            <View style={styles.selectionHeader}>
              <Pressable onPress={() => { setShowAddModal(false); setSearchQuery(''); setSelectedProducts(new Set()); setProductQuantities({}); }} hitSlop={12}>
                <MaterialIcons name="arrow-back" size={24} color={colors.text} />
              </Pressable>
              <View style={styles.searchBar}>
                <MaterialIcons name="search" size={20} color={colors.textSecondary} />
                <TextInput ref={searchInputRef} style={styles.searchBarInput} placeholder="Ajoutez un nouvel article" placeholderTextColor={colors.textLight} value={searchQuery} onChangeText={setSearchQuery} />
                {searchQuery.length > 0 && <Pressable onPress={() => setSearchQuery('')} hitSlop={8}><MaterialIcons name="close" size={20} color={colors.textSecondary} /></Pressable>}
              </View>
              <Pressable onPress={handleAddSelectedProducts} disabled={addingProducts || (!searchQuery.trim() && selectedProducts.size === 0)}
                style={({ pressed }) => [styles.headerAddButton, (addingProducts || (!searchQuery.trim() && selectedProducts.size === 0)) && styles.headerAddButtonDisabled, pressed && { opacity: 0.7 }]}
                hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}>
                {addingProducts ? <ActivityIndicator size="small" color={colors.accent} /> : <Text style={[styles.headerAddButtonText, (!searchQuery.trim() && selectedProducts.size === 0) && styles.headerAddButtonTextDisabled]}>Ajouter</Text>}
              </Pressable>
            </View>
            <ScrollView style={styles.selectionList} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {loading ? (
                <View style={styles.selectionLoadingContainer}><ActivityIndicator size="large" color={colors.primary} /><Text style={styles.loadingText}>Chargement des ingrédients...</Text></View>
              ) : loadError ? (
                <View style={styles.noResultsContainer}><MaterialIcons name="error-outline" size={48} color={colors.error} /><Text style={styles.noResultsText}>{loadError}</Text></View>
              ) : (
                <>
                  {(activeSelectionTab === 'suggested' ? filteredSuggestions : filteredRecents).length === 0 && searchQuery.trim() && (
                    <View style={styles.noResultsContainer}>
                      <MaterialIcons name="search-off" size={48} color={colors.textLight} />
                      <Text style={styles.noResultsText}>Aucun résultat trouvé</Text>
                      <Pressable onPress={async () => { await addItem({ id: `custom-${Date.now()}-${Math.random()}`, name: searchQuery.trim(), quantity: '1', unit: 'unité', price: 0, store: '', checked: false }, selectedStores); setSearchQuery(''); setShowAddModal(false); }}
                        style={({ pressed }) => [styles.createButton, pressed && { opacity: 0.9 }]}>
                        <MaterialIcons name="add-circle" size={24} color={colors.error} />
                        <Text style={styles.createButtonText}>Créer "{searchQuery.trim()}"</Text>
                      </Pressable>
                    </View>
                  )}
                  {(activeSelectionTab === 'suggested' ? filteredSuggestions : filteredRecents).map((product) => {
                    const existingItem = getProductInList(product.id);
                    const isInList = !!existingItem;
                    return (
                      <View key={product.id} style={styles.productSelectionRow}>
                        <Pressable onPress={() => handleProductClick(product)} style={({ pressed }) => [styles.productClickableArea, pressed && { backgroundColor: colors.surfaceLight }]}>
                          <View style={styles.productLeftSection}><Text style={styles.productName}>{product.name}</Text></View>
                          <View style={styles.productRightSection}>
                            {isInList && existingItem && <Text style={styles.productQuantityInList}>{existingItem.quantity} {existingItem.unit}</Text>}
                            <View style={[styles.productCheckCircle, isInList && styles.productCheckCircleActive]}>
                              {isInList ? <MaterialIcons name="check" size={20} color={colors.surface} /> : <MaterialIcons name="add" size={20} color={colors.textLight} />}
                            </View>
                          </View>
                        </Pressable>
                        {isInList && <Pressable onPress={() => handleRemoveFromModal(product)} style={({ pressed }) => [styles.productRemoveButton, pressed && { opacity: 0.7 }]} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}><MaterialIcons name="close" size={24} color={colors.error} /></Pressable>}
                      </View>
                    );
                  })}
                </>
              )}
            </ScrollView>
          </View>
        </Modal>

        {/* Modal édition */}
        <Modal visible={showEditModal} animationType="slide" transparent={true} onRequestClose={handleCancelEdit}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            <View style={styles.editModalOverlay}>
              <View style={[styles.editModalContainer, { paddingBottom: insets.bottom + spacing.xl }]}>
                <View style={styles.editModalHeader}>
                  <Pressable onPress={handleCancelEdit} hitSlop={12}><MaterialIcons name="close" size={28} color={colors.text} /></Pressable>
                  <Text style={styles.editModalTitle}>Modifier l'article</Text>
                  <Pressable onPress={handleSaveEdit} hitSlop={12}><MaterialIcons name="check" size={28} color={colors.primary} /></Pressable>
                </View>
                <ScrollView style={styles.editModalContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  <View style={styles.editSection}>
                    <Text style={styles.editSectionTitle}>Produit</Text>
                    <TextInput style={styles.editInput} value={editName} onChangeText={setEditName} placeholder="Nom de l'article" placeholderTextColor={colors.textLight} />
                  </View>
                  <View style={styles.editSection}>
                    <Text style={styles.editSectionTitle}>Quantité</Text>
                    <View style={styles.quantityControls}>
                      <Pressable onPress={decrementEditQuantity} style={({ pressed }) => [styles.quantityButton, pressed && { opacity: 0.7 }]}><MaterialIcons name="remove" size={24} color={colors.primary} /></Pressable>
                      <Text style={styles.quantityValue}>{editQuantity}</Text>
                      <Pressable onPress={incrementEditQuantity} style={({ pressed }) => [styles.quantityButton, pressed && { opacity: 0.7 }]}><MaterialIcons name="add" size={24} color={colors.primary} /></Pressable>
                    </View>
                  </View>
                  <View style={styles.editSection}>
                    <Text style={styles.editSectionTitle}>Unité</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.unitChips}>
                      {availableUnits.map(unit => (
                        <Pressable key={unit} onPress={() => setEditUnit(unit)} style={({ pressed }) => [styles.unitChip, editUnit === unit && styles.unitChipSelected, pressed && { opacity: 0.7 }]}>
                          <Text style={[styles.unitChipText, editUnit === unit && styles.unitChipTextSelected]}>{unit}</Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                  <View style={styles.editSection}>
                    <Text style={styles.editSectionTitle}>Catégorie</Text>
                    <Pressable onPress={() => setShowCategoryPicker(!showCategoryPicker)} style={({ pressed }) => [styles.categorySelector, pressed && { opacity: 0.8 }]}>
                      <View style={styles.categorySelectorContent}>
                        <MaterialIcons name={currentCategoryData.icon as any} size={24} color={currentCategoryData.color} />
                        <Text style={styles.categorySelectorText}>{currentCategoryData.label}</Text>
                      </View>
                      <MaterialIcons name={showCategoryPicker ? 'expand-less' : 'expand-more'} size={24} color={colors.textSecondary} />
                    </Pressable>
                    {showCategoryPicker && (
                      <View style={styles.categoryPicker}>
                        {categories.map(cat => (
                          <Pressable key={cat.key} onPress={() => { setEditCategory(cat.key); setShowCategoryPicker(false); }} style={({ pressed }) => [styles.categoryOption, editCategory === cat.key && styles.categoryOptionSelected, pressed && { backgroundColor: colors.surfaceLight }]}>
                            <MaterialIcons name={cat.icon as any} size={24} color={cat.color} />
                            <Text style={styles.categoryOptionText}>{cat.label}</Text>
                            {editCategory === cat.key && <MaterialIcons name="check" size={24} color={colors.primary} />}
                          </Pressable>
                        ))}
                      </View>
                    )}
                  </View>
                  <View style={styles.editSection}>
                    <Text style={styles.editSectionTitle}>Note (optionnelle)</Text>
                    <TextInput style={[styles.editInput, styles.editTextArea]} value={editNote} onChangeText={setEditNote} placeholder="Ajoutez une note..." placeholderTextColor={colors.textLight} multiline numberOfLines={3} textAlignVertical="top" />
                  </View>
                  <View style={styles.editSection}>
                    <Text style={styles.editSectionTitle}>Photo (optionnelle)</Text>
                    {editPhoto ? (
                      <View style={styles.photoPreviewContainer}>
                        <Image source={{ uri: editPhoto }} style={styles.photoPreview} />
                        <Pressable onPress={() => setEditPhoto(undefined)} style={({ pressed }) => [styles.removePhotoButton, pressed && { opacity: 0.7 }]}><MaterialIcons name="close" size={24} color={colors.surface} /></Pressable>
                      </View>
                    ) : (
                      <View style={styles.photoButtons}>
                        <Pressable onPress={takePhoto} style={({ pressed }) => [styles.photoButton, pressed && { opacity: 0.8 }]}><MaterialIcons name="camera-alt" size={28} color={colors.primary} /><Text style={styles.photoButtonText}>Prendre une photo</Text></Pressable>
                        <Pressable onPress={pickImage} style={({ pressed }) => [styles.photoButton, pressed && { opacity: 0.8 }]}><MaterialIcons name="photo-library" size={28} color={colors.primary} /><Text style={styles.photoButtonText}>Choisir de la galerie</Text></Pressable>
                      </View>
                    )}
                  </View>
                </ScrollView>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: colors.darkBeige, paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.lg, borderBottomLeftRadius: borderRadius.xl, borderBottomRightRadius: borderRadius.xl, zIndex: 1 },
  title: { ...typography.h1, color: colors.text, marginBottom: spacing.xs },
  subtitle: { ...typography.body, color: colors.textSecondary },
  buttonsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, marginTop: spacing.md },
  pantryButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: borderRadius.full, borderWidth: 2, borderColor: colors.primary, backgroundColor: 'transparent' },
  pantryButtonText: { ...typography.body, color: colors.primary, fontWeight: '600', fontSize: 14 },
  iconRoundButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  filterBadge: { position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: 8, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  filterBadgeText: { fontSize: 10, fontWeight: '700', color: '#fff' },
  bestStoreText: { ...typography.caption, color: colors.textSecondary, fontStyle: 'italic', marginTop: spacing.sm },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContainer: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle: { ...typography.h2, color: colors.text },
  filterChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.full, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterChipText: { ...typography.caption, color: colors.text },
  filterChipTextActive: { color: '#fff', fontWeight: '600' },
  applyButton: { margin: spacing.lg, backgroundColor: colors.primary, borderRadius: borderRadius.full, paddingVertical: spacing.md, alignItems: 'center' },
  applyButtonText: { ...typography.bodyBold, color: '#fff', fontSize: 16 },
  listContent: { paddingHorizontal: spacing.md, zIndex: 10 },
  sectionHeader: { paddingTop: spacing.lg, paddingBottom: spacing.sm },
  firstSectionHeader: { paddingTop: spacing.xl * 3 },
  sectionTitle: { ...typography.bodyBold, color: colors.textSecondary, fontSize: 14, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.xs },
  sectionDivider: { height: 1, backgroundColor: colors.border },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxl * 2 },
  emptyText: { ...typography.h3, color: colors.textSecondary, marginTop: spacing.lg },
  emptySubtext: { ...typography.caption, color: colors.textLight, marginTop: spacing.xs },
  lockedContentContainer: { paddingHorizontal: spacing.lg, paddingVertical: spacing.lg },
  lockedContainer: { alignItems: 'center', paddingVertical: spacing.xl, paddingBottom: 100 },
  lockedTitle: { fontSize: 32, fontWeight: '400', color: colors.text, textAlign: 'center', marginTop: spacing.lg, marginBottom: spacing.sm, ...Platform.select({ ios: { fontFamily: 'Georgia' }, android: { fontFamily: 'serif' }, default: { fontFamily: 'Georgia' } }) },
  lockedText: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.xl, lineHeight: 24 },
  pricingCard: { width: '100%', backgroundColor: colors.surface, borderRadius: borderRadius.xl, padding: spacing.xl, marginBottom: spacing.lg, alignItems: 'center', borderWidth: 2, borderColor: colors.border, position: 'relative' },
  pricingCardPopular: { borderColor: colors.accent, borderWidth: 3 },
  popularBadge: { position: 'absolute', top: -12, right: spacing.lg, backgroundColor: colors.accent, borderRadius: borderRadius.full, paddingVertical: 4, paddingHorizontal: spacing.md },
  popularBadgeText: { fontSize: 12, fontWeight: '700', color: colors.surface },
  pricingPeriod: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: spacing.sm },
  pricingAmount: { fontSize: 36, fontWeight: '400', color: colors.text, marginBottom: spacing.xs, ...Platform.select({ ios: { fontFamily: 'Georgia' }, android: { fontFamily: 'serif' }, default: { fontFamily: 'Georgia' } }) },
  pricingTrial: { fontSize: 14, color: colors.textSecondary, marginBottom: spacing.md },
  pricingButton: { backgroundColor: colors.primary, borderRadius: borderRadius.full, paddingVertical: spacing.md, paddingHorizontal: spacing.xl },
  pricingButtonText: { fontSize: 14, fontWeight: '600', color: colors.surface },
  freeAccessInfo: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.md, marginTop: spacing.md },
  freeAccessText: { flex: 1, fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  scrollView: { flex: 1 },
  fabButton: { position: 'absolute', right: spacing.lg, width: 64, height: 64, borderRadius: borderRadius.full, backgroundColor: colors.accent, justifyContent: 'center', alignItems: 'center', ...shadows.lg },
  selectionModalContainer: { flex: 1, backgroundColor: colors.background },
  selectionHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.md, gap: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerAddButton: { paddingHorizontal: spacing.xl, paddingVertical: spacing.sm, minWidth: 80, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent', borderRadius: 999, borderWidth: 2, borderColor: colors.error },
  headerAddButtonDisabled: { opacity: 0.3 },
  headerAddButtonText: { ...typography.bodyBold, color: colors.error, fontSize: 16 },
  headerAddButtonTextDisabled: { color: colors.error },
  searchBar: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceLight, borderRadius: borderRadius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm },
  searchBarInput: { flex: 1, ...typography.body, color: '#000000', paddingVertical: spacing.xs },
  selectionList: { flex: 1 },
  selectionLoadingContainer: { paddingVertical: spacing.xxl, alignItems: 'center', gap: spacing.md },
  loadingText: { ...typography.body, color: colors.textSecondary },
  productSelectionRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.divider },
  productClickableArea: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.lg, paddingLeft: spacing.lg, paddingRight: spacing.sm },
  productLeftSection: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: spacing.md },
  productRightSection: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  productCheckCircle: { width: 40, height: 40, borderRadius: borderRadius.full, backgroundColor: colors.surfaceLight, borderWidth: 2, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' },
  productCheckCircleActive: { backgroundColor: colors.textSecondary, borderColor: colors.textSecondary },
  productRemoveButton: { paddingHorizontal: spacing.lg, paddingVertical: spacing.lg },
  productQuantityInList: { ...typography.body, color: colors.textSecondary, fontWeight: '600', marginRight: spacing.sm },
  productName: { ...typography.body, color: '#000000', fontWeight: '600', flex: 1 },
  noResultsContainer: { alignItems: 'center', paddingVertical: spacing.xxl * 2, paddingHorizontal: spacing.lg },
  noResultsText: { ...typography.body, color: colors.textSecondary, marginTop: spacing.md, marginBottom: spacing.sm, textAlign: 'center' },
  createButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'transparent', paddingVertical: spacing.md, paddingHorizontal: spacing.lg, borderRadius: 999, gap: spacing.sm, borderWidth: 2, borderColor: colors.error },
  createButtonText: { ...typography.bodyBold, color: colors.error, fontSize: 16 },
  editModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  editModalContainer: { backgroundColor: colors.surface, borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl, maxHeight: '90%' },
  editModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  editModalTitle: { ...typography.h3, color: colors.text },
  editModalContent: { padding: spacing.lg },
  editSection: { marginBottom: spacing.xl },
  editSectionTitle: { ...typography.bodyBold, color: colors.textSecondary, marginBottom: spacing.sm },
  editInput: { backgroundColor: colors.background, borderRadius: borderRadius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, ...typography.body, color: colors.text, borderWidth: 1, borderColor: colors.border },
  editTextArea: { minHeight: 80, paddingTop: spacing.sm },
  quantityControls: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  quantityButton: { width: 48, height: 48, borderRadius: borderRadius.md, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  quantityValue: { ...typography.h2, color: colors.text, minWidth: 60, textAlign: 'center' },
  unitChips: { flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.xs },
  unitChip: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: borderRadius.full, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  unitChipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  unitChipText: { ...typography.caption, color: colors.text, fontWeight: '600' },
  unitChipTextSelected: { color: colors.surface },
  categorySelector: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.background, borderRadius: borderRadius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderWidth: 1, borderColor: colors.border },
  categorySelectorContent: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  categorySelectorText: { ...typography.body, color: colors.text },
  categoryPicker: { marginTop: spacing.sm, backgroundColor: colors.background, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  categoryOption: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  categoryOptionSelected: { backgroundColor: colors.surfaceLight },
  categoryOptionText: { ...typography.body, color: colors.text, flex: 1 },
  photoButtons: { flexDirection: 'row', gap: spacing.md },
  photoButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.background, borderRadius: borderRadius.md, paddingVertical: spacing.lg, borderWidth: 1, borderColor: colors.border },
  photoButtonText: { ...typography.caption, color: colors.primary, fontWeight: '600' },
  photoPreviewContainer: { position: 'relative', borderRadius: borderRadius.md, overflow: 'hidden' },
  photoPreview: { width: '100%', height: 200, borderRadius: borderRadius.md },
  removePhotoButton: { position: 'absolute', top: spacing.sm, right: spacing.sm, backgroundColor: colors.error, borderRadius: borderRadius.full, width: 32, height: 32, justifyContent: 'center', alignItems: 'center', ...shadows.md },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  clearButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: borderRadius.full, borderWidth: 2, borderColor: colors.error, backgroundColor: 'transparent' },
  clearButtonText: { ...typography.body, color: colors.error, fontSize: 14, fontWeight: '600' },
bestStoreCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.sm, marginTop: spacing.sm, borderLeftWidth: 3, borderLeftColor: colors.primary },
bestStoreCardText: { ...typography.caption, color: colors.text, flex: 1 },
bestStoreCardName: { ...typography.captionBold, color: colors.primary, fontWeight: '700' },
});
