import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  TextInput,
  Alert,
  Modal,
  Linking,
  Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import { 
  getIngredientDetail, 
  IngredientDetail,
  updateIngredientConversionFactor 
} from '@/services/ingredientDetailService';
import {
  getExclusionKeywords,
  addExclusionKeyword,
  removeExclusionKeyword,
  ExclusionKeyword,
} from '@/services/ingredientExclusionKeywordsService';
import { updatePrice } from '@/services/priceUpdateService';
import {
  getInclusionKeywords,
  addInclusionKeyword,
  removeInclusionKeyword,
  InclusionKeyword,
} from '@/services/ingredientInclusionKeywordsService';
import {
  getIngredientConversions,
  addIngredientConversion,
  deleteIngredientConversion,
  updateIngredientConversion,
  IngredientConversion,
  calculatePricePerBaseUnit,
} from '@/services/ingredientConversionsService';
import { deleteIngredientMapping } from '@/services/ingredientMappingManagementService';
import { scrapeIngredientAsync, IngredientScrapingProgress, ScrapingMethod } from '@/services/ingredientScrapingService';
import { extractProductQuantity } from '@/services/productQuantityExtractionService';
import { createMissingFormatsJob, getJobStatus, cancelJob, MissingFormatsJob } from '@/services/completeMissingFormatsServiceAsync';

export default function IngredientDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  
  const [ingredient, setIngredient] = useState<IngredientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [removingMapping, setRemovingMapping] = useState<string | null>(null);
  const [scrapingProduct, setScrapingProduct] = useState(false);
  const [scrapingProgress, setScrapingProgress] = useState<IngredientScrapingProgress | null>(null);
  
  // Gestion des mots-clés d'exclusion
  const [exclusionKeywords, setExclusionKeywords] = useState<ExclusionKeyword[]>([]);
  const [showAddExclusionForm, setShowAddExclusionForm] = useState(false);
  const [newExclusionKeyword, setNewExclusionKeyword] = useState('');
  const [addingExclusion, setAddingExclusion] = useState(false);
  const [removingExclusion, setRemovingExclusion] = useState<string | null>(null);
  
  // Gestion des mots-clés d'inclusion
  const [inclusionKeywords, setInclusionKeywords] = useState<InclusionKeyword[]>([]);
  const [showAddInclusionForm, setShowAddInclusionForm] = useState(false);
  const [newInclusionKeyword, setNewInclusionKeyword] = useState('');
  const [addingInclusion, setAddingInclusion] = useState(false);
  const [removingInclusion, setRemovingInclusion] = useState<string | null>(null);
  
  // Gestion des conversions multiples
  const [conversions, setConversions] = useState<IngredientConversion[]>([]);
  const [showAddConversionForm, setShowAddConversionForm] = useState(false);
  const [newConversionFromUnit, setNewConversionFromUnit] = useState('');
  const [newConversionFactor, setNewConversionFactor] = useState('');
  const [addingConversion, setAddingConversion] = useState(false);
  const [removingConversion, setRemovingConversion] = useState<string | null>(null);
  const [editingConversionId, setEditingConversionId] = useState<string | null>(null);
  const [editConversionUnit, setEditConversionUnit] = useState('');
  const [editConversionFactor, setEditConversionFactor] = useState('');
  const [savingEditConversion, setSavingEditConversion] = useState(false);
  const [showConversionUnitModal, setShowConversionUnitModal] = useState(false);
  
  // Gestion du modal de détail produit
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [showProductDetailModal, setShowProductDetailModal] = useState(false);
  
  // Gestion de l'édition de prix
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [editParsedQuantity, setEditParsedQuantity] = useState('');
  const [editUnit, setEditUnit] = useState<string>('g');
  const [editUnitType, setEditUnitType] = useState<'kg' | 'L' | 'unit' | null>(null);
  const [editRegularPrice, setEditRegularPrice] = useState('');
  const [editSalePrice, setEditSalePrice] = useState('');
  const [editIsOnSale, setEditIsOnSale] = useState(false);
  const [editScrapeUrl, setEditScrapeUrl] = useState('');
  const [editBrand, setEditBrand] = useState('');
  const [savingPrice, setSavingPrice] = useState(false);
  const [showUnitModal, setShowUnitModal] = useState(false);
  const [showUnitDropdown, setShowUnitDropdown] = useState(false);
  
  // Extraction de quantité depuis URL
  const [extractingQuantityForId, setExtractingQuantityForId] = useState<string | null>(null);
  
  // Complétion des formats manquants (asynchrone)
  const [completingFormats, setCompletingFormats] = useState(false);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<MissingFormatsJob | null>(null);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);

  // Liste des unités disponibles
  const AVAILABLE_UNITS = ['g', 'kg', 'ml', 'L', 'unité', 'gousse', 'tête', 'paquet', 'boîte', 'c. à soupe', 'c. à thé', 'tasse', 'pincée'];

  // Rafraîchir TOUJOURS quand on revient sur cette page
  useFocusEffect(
    useCallback(() => {
      console.log('[IngredientDetail] Page refocused - rafraîchissement forcé...');
      loadIngredient();
      loadExclusionKeywords();
      loadInclusionKeywords();
      loadConversions();
    }, [id])
  );

  const loadIngredient = async () => {
    if (!id) return;
    
    setLoading(true);
    try {
      const data = await getIngredientDetail(id);
      setIngredient(data);
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de charger les détails de l\'ingrédient');
    } finally {
      setLoading(false);
    }
  };

  const loadExclusionKeywords = async () => {
    if (!id) return;
    
    const keywords = await getExclusionKeywords(id);
    setExclusionKeywords(keywords);
  };

  const loadInclusionKeywords = async () => {
    if (!id) return;
    
    const keywords = await getInclusionKeywords(id);
    setInclusionKeywords(keywords);
  };

  const loadConversions = async () => {
    if (!id) return;
    
    const data = await getIngredientConversions(id);
    setConversions(data);
  };

  const handleAddConversion = async () => {
    if (!id || !newConversionFromUnit.trim() || !newConversionFactor.trim()) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs');
      return;
    }

    const factor = parseFloat(newConversionFactor);
    if (isNaN(factor) || factor <= 0) {
      Alert.alert('Erreur', 'Le facteur doit être un nombre positif');
      return;
    }

    // Inverser le facteur car l'utilisateur entre "1 gousse = 10g" mais on stocke "1g = 0.1 gousse"
    const inverseFactor = 1 / factor;

    setAddingConversion(true);
    try {
      const result = await addIngredientConversion(id, newConversionFromUnit.trim(), inverseFactor);
      
      if (result.success) {
        setNewConversionFromUnit('');
        setNewConversionFactor('');
        setShowAddConversionForm(false);
        await loadConversions();
      } else {
        Alert.alert('Erreur', result.error || 'Impossible d\'ajouter la conversion');
      }
    } catch (error: any) {
      Alert.alert('Erreur', error.message);
    } finally {
      setAddingConversion(false);
    }
  };

  const handleRemoveConversion = async (conversionId: string, fromUnit: string) => {
    Alert.alert(
      'Supprimer la conversion',
      `Voulez-vous vraiment supprimer la conversion "${fromUnit}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            setRemovingConversion(conversionId);
            try {
              const result = await deleteIngredientConversion(conversionId);
              if (result.success) {
                await loadConversions();
              } else {
                Alert.alert('Erreur', result.error || 'Impossible de supprimer');
              }
            } catch (error: any) {
              Alert.alert('Erreur', error.message);
            } finally {
              setRemovingConversion(null);
            }
          },
        },
      ]
    );
  };

  const startEditConversion = (conversion: IngredientConversion) => {
    setEditingConversionId(conversion.id);
    setEditConversionUnit(conversion.fromUnit);
    // Inverser pour affichage : "1 gousse = 10g" au lieu de "1g = 0.1 gousse"
    const inverseForDisplay = 1 / conversion.toBaseUnitFactor;
    setEditConversionFactor(inverseForDisplay.toString());
  };

  const cancelEditConversion = () => {
    setEditingConversionId(null);
    setEditConversionUnit('');
    setEditConversionFactor('');
  };

  const handleSaveEditConversion = async () => {
    if (!editingConversionId) return;

    const factor = parseFloat(editConversionFactor);
    if (isNaN(factor) || factor <= 0) {
      Alert.alert('Erreur', 'Le facteur doit être un nombre positif');
      return;
    }

    // Inverser le facteur car l'utilisateur entre "1 gousse = 10g" mais on stocke "1g = 0.1 gousse"
    const inverseFactor = 1 / factor;

    setSavingEditConversion(true);
    try {
      const result = await updateIngredientConversion(editingConversionId, editConversionUnit, inverseFactor);
      if (result.success) {
        cancelEditConversion();
        await loadConversions();
      } else {
        Alert.alert('Erreur', result.error || 'Impossible de mettre à jour');
      }
    } catch (error: any) {
      Alert.alert('Erreur', error.message);
    } finally {
      setSavingEditConversion(false);
    }
  };

  const handleAddExclusion = async () => {
    if (!id || !newExclusionKeyword.trim()) return;
    
    setAddingExclusion(true);
    try {
      const result = await addExclusionKeyword(id, newExclusionKeyword.trim());
      
      if (result.success) {
        Alert.alert('Succès', 'Mot-clé ajouté aux exclusions');
        setNewExclusionKeyword('');
        setShowAddExclusionForm(false);
        await loadExclusionKeywords();
        await loadIngredient();
      } else {
        Alert.alert('Erreur', result.error || 'Impossible d\'ajouter le mot-clé');
      }
    } catch (error: any) {
      Alert.alert('Erreur', error.message || 'Impossible d\'ajouter le mot-clé');
    } finally {
      setAddingExclusion(false);
    }
  };

  const handleAddInclusion = async () => {
    if (!id || !newInclusionKeyword.trim()) return;
    
    setAddingInclusion(true);
    try {
      const result = await addInclusionKeyword(id, newInclusionKeyword.trim());
      
      if (result.success) {
        Alert.alert('Succès', 'Mot-clé ajouté aux inclusions obligatoires');
        setNewInclusionKeyword('');
        setShowAddInclusionForm(false);
        await loadInclusionKeywords();
        await loadIngredient();
      } else {
        Alert.alert('Erreur', result.error || 'Impossible d\'ajouter le mot-clé');
      }
    } catch (error: any) {
      Alert.alert('Erreur', error.message || 'Impossible d\'ajouter le mot-clé');
    } finally {
      setAddingInclusion(false);
    }
  };

  const handleRemoveExclusion = async (keywordId: string, keyword: string) => {
    Alert.alert(
      'Confirmer la suppression',
      `Voulez-vous vraiment retirer "${keyword}" des exclusions ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Retirer',
          style: 'destructive',
          onPress: async () => {
            setRemovingExclusion(keywordId);
            try {
              const result = await removeExclusionKeyword(keywordId);
              
              if (result.success) {
                Alert.alert('Succès', 'Mot-clé retiré des exclusions');
                await loadExclusionKeywords();
                await loadIngredient();
              } else {
                Alert.alert('Erreur', result.error || 'Impossible de retirer le mot-clé');
              }
            } catch (error: any) {
              Alert.alert('Erreur', error.message || 'Impossible de retirer le mot-clé');
            } finally {
              setRemovingExclusion(null);
            }
          },
        },
      ]
    );
  };

  const handleRemoveInclusion = async (keywordId: string, keyword: string) => {
    Alert.alert(
      'Confirmer la suppression',
      `Voulez-vous vraiment retirer "${keyword}" des inclusions obligatoires ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Retirer',
          style: 'destructive',
          onPress: async () => {
            setRemovingInclusion(keywordId);
            try {
              const result = await removeInclusionKeyword(keywordId);
              
              if (result.success) {
                Alert.alert('Succès', 'Mot-clé retiré des inclusions obligatoires');
                await loadInclusionKeywords();
                await loadIngredient();
              } else {
                Alert.alert('Erreur', result.error || 'Impossible de retirer le mot-clé');
              }
            } catch (error: any) {
              Alert.alert('Erreur', error.message || 'Impossible de retirer le mot-clé');
            } finally {
              setRemovingInclusion(null);
            }
          },
        },
      ]
    );
  };
  
  const handleEditPrice = (price: typeof ingredient.prices[0]) => {
    setEditingPriceId(price.priceId);
    setEditParsedQuantity(price.parsedQuantity?.toString() || '');
    setEditUnitType(price.unitType);
    setEditRegularPrice(price.regularPrice.toString());
    setEditSalePrice(price.salePrice?.toString() || '');
    setEditIsOnSale(price.isOnSale);
    setEditScrapeUrl(price.scrapeUrl || '');
    setEditBrand(price.brand || '');
    
    // Essayer d'extraire l'unité depuis le format
    let extracted = extractQuantityAndUnit(price.quantity, price.parsedQuantity);
    
    // Si échec, essayer depuis le nom du produit (ex: "Oignon jaune | 1,36 kg")
    if (!extracted && price.productName) {
      extracted = extractQuantityAndUnit(price.productName, price.parsedQuantity);
    }
    
    if (extracted) {
      setEditUnit(extracted.unit);
      // Mettre à jour parsedQuantity si différent
      if (!price.parsedQuantity || price.parsedQuantity !== extracted.quantity) {
        setEditParsedQuantity(extracted.quantity.toString());
      }
    } else {
      setEditUnit('unité');
    }
  };

  const handleCancelEdit = () => {
    setEditingPriceId(null);
    setEditParsedQuantity('');
    setEditUnit('g');
    setEditUnitType(null);
    setEditRegularPrice('');
    setEditSalePrice('');
    setEditIsOnSale(false);
    setEditScrapeUrl('');
    setEditBrand('');
  };

  const handleExtractQuantity = async (priceId: string, scrapeUrl: string) => {
    if (!scrapeUrl || !scrapeUrl.startsWith('http')) {
      Alert.alert('Erreur', 'URL invalide ou manquante pour ce produit');
      return;
    }

    setExtractingQuantityForId(priceId);
    try {
      const result = await extractProductQuantity(scrapeUrl, priceId);
      
      if (result.error) {
        Alert.alert('Erreur d\'extraction', result.error);
      } else if (result.quantity) {
        Alert.alert('Succès', `Format extrait: ${result.quantity}. Rechargement des données...`);
        await loadIngredient();
      } else {
        Alert.alert('Aucun format trouvé', 'Impossible d\'extraire la quantité depuis cette page.');
      }
    } catch (error: any) {
      Alert.alert('Erreur', error.message || 'Une erreur est survenue');
    } finally {
      setExtractingQuantityForId(null);
    }
  };

  const handleCompleteMissingFormats = async () => {
    if (!ingredient) return;

    // Compter les produits sans format
    const productsWithoutFormat = ingredient.prices?.filter(p => !p.quantity || p.quantity.trim() === '') || [];

    if (productsWithoutFormat.length === 0) {
      Alert.alert('Information', 'Tous les produits ont déjà un format défini.');
      return;
    }

    Alert.alert(
      'Compléter les formats',
      `${productsWithoutFormat.length} produit(s) sans format détecté(s).\n\n⚙️ Le traitement se fera en arrière-plan. Vous pouvez quitter cette page et revenir plus tard.\n\nContinuer ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Démarrer',
          onPress: async () => {
            await startAsyncCompletion();
          },
        },
      ]
    );
  };

  const startAsyncCompletion = async () => {
    if (!ingredient) return;

    setCompletingFormats(true);

    try {
      const { jobId, error } = await createMissingFormatsJob(ingredient.id);

      if (error || !jobId) {
        setCompletingFormats(false);
        Alert.alert('Erreur', error || 'Impossible de créer le job');
        return;
      }

      console.log('[startAsyncCompletion] Job créé:', jobId);
      setCurrentJobId(jobId);

      // Démarrer le polling pour suivre la progression
      startPolling(jobId);
    } catch (error: any) {
      setCompletingFormats(false);
      Alert.alert('Erreur', error.message || 'Une erreur est survenue');
    }
  };

  const startPolling = (jobId: string) => {
    // Arrêter le polling existant
    if (pollingInterval) {
      clearInterval(pollingInterval);
    }

    // Démarrer le polling toutes les 3 secondes
    const interval = setInterval(async () => {
      const { job, error } = await getJobStatus(jobId);

      if (error || !job) {
        console.error('[startPolling] Erreur récupération statut:', error);
        return;
      }

      setJobStatus(job);

      // Si le job est terminé ou a échoué, arrêter le polling
      if (job.status === 'completed' || job.status === 'failed') {
        clearInterval(interval);
        setPollingInterval(null);
        setCompletingFormats(false);

        if (job.status === 'completed') {
          Alert.alert(
            'Complétion terminée',
            `${job.productsUpdated} format(s) récupéré(s) sur ${job.productsProcessed} produit(s) traité(s).`,
            [
              {
                text: 'OK',
                onPress: () => {
                  setJobStatus(null);
                  setCurrentJobId(null);
                  loadIngredient();
                },
              },
            ]
          );
        } else {
          Alert.alert(
            'Erreur',
            job.errorMessage || 'Le traitement a échoué',
            [
              {
                text: 'OK',
                onPress: () => {
                  setJobStatus(null);
                  setCurrentJobId(null);
                },
              },
            ]
          );
        }
      }
    }, 3000);

    setPollingInterval(interval);
  };

  const handleCancelJob = async () => {
    if (!currentJobId) return;

    Alert.alert(
      'Annuler le traitement',
      'Voulez-vous vraiment annuler le traitement en cours ?',
      [
        { text: 'Non', style: 'cancel' },
        {
          text: 'Oui',
          style: 'destructive',
          onPress: async () => {
            const { success, error } = await cancelJob(currentJobId);

            if (error || !success) {
              Alert.alert('Erreur', error || 'Impossible d\'annuler le job');
              return;
            }

            if (pollingInterval) {
              clearInterval(pollingInterval);
              setPollingInterval(null);
            }

            setCompletingFormats(false);
            setCurrentJobId(null);
            setJobStatus(null);
            Alert.alert('Annulation', 'Le traitement a été annulé.');
          },
        },
      ]
    );
  };

  // Nettoyer le polling au démontage
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [pollingInterval]);

  const handleSavePrice = async () => {
    if (!editingPriceId) return;

    const parsedQty = parseFloat(editParsedQuantity);
    const regPrice = parseFloat(editRegularPrice);
    const salePrice = editSalePrice ? parseFloat(editSalePrice) : null;

    if (isNaN(parsedQty) || parsedQty <= 0) {
      Alert.alert('Erreur', 'Veuillez entrer une quantité numérique valide supérieure à 0');
      return;
    }

    if (isNaN(regPrice) || regPrice <= 0) {
      Alert.alert('Erreur', 'Veuillez entrer un prix régulier valide supérieur à 0');
      return;
    }

    if (salePrice && (isNaN(salePrice) || salePrice >= regPrice)) {
      Alert.alert('Erreur', 'Le prix en rabais doit être inférieur au prix régulier');
      return;
    }

    // Construire le format à partir de la quantité et de l'unité
    const formattedQuantity = `${editParsedQuantity} ${editUnit}`;

    setSavingPrice(true);
    try {
      const result = await updatePrice(editingPriceId, {
        quantity: formattedQuantity,
        parsedQuantity: parsedQty,
        unitType: editUnitType,
        regularPrice: regPrice,
        salePrice: editIsOnSale && salePrice ? salePrice : null,
        isOnSale: editIsOnSale && !!salePrice,
        scrapeUrl: editScrapeUrl.trim() || null,
        brand: editBrand.trim() || null,
      });

      if (result.success) {
        Alert.alert('Succès', 'Prix mis à jour avec succès');
        handleCancelEdit();
        await loadIngredient();
      } else {
        Alert.alert('Erreur', result.error || 'Impossible de mettre à jour le prix');
      }
    } catch (error: any) {
      Alert.alert('Erreur', error.message || 'Impossible de mettre à jour le prix');
    } finally {
      setSavingPrice(false);
    }
  };

  const handleRemoveMapping = async (productId: string, productName: string) => {
    Alert.alert(
      'Confirmer la suppression',
      `Voulez-vous vraiment retirer l'association avec "${productName}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Retirer',
          style: 'destructive',
          onPress: async () => {
            if (!id) return;
            
            setRemovingMapping(productId);
            try {
              const result = await deleteIngredientMapping(id, productId);
              
              if (result.success) {
                Alert.alert('Succès', 'Association retirée');
                await loadIngredient();
              } else {
                Alert.alert('Erreur', result.error || 'Impossible de retirer l\'association');
              }
            } catch (error: any) {
              Alert.alert('Erreur', error.message || 'Impossible de retirer l\'association');
            } finally {
              setRemovingMapping(null);
            }
          },
        },
      ]
    );
  };

  const handleScrapeProduct = async () => {
    if (!ingredient) return;
    
    // Demander la méthode de scraping
    Alert.alert(
      'Méthode de scraping',
      'Choisissez votre méthode de scraping:',
      [
        { 
          text: 'Annuler', 
          style: 'cancel' 
        },
        {
          text: '🛒 Google Shopping (Recommandé)',
          onPress: () => performScraping('google-shopping'),
        },
        {
          text: '🌐 Traditionnel (lent)',
          onPress: () => performScraping('traditional'),
        },
      ],
      { cancelable: true }
    );
  };

  const performScraping = async (method: ScrapingMethod) => {
    if (!ingredient) return;

    const methodName = method === 'google-shopping' ? 'Google Shopping' : 'traditionnel';
    const estimatedTime = method === 'google-shopping' ? '~10 secondes' : '2-3 minutes (7 magasins)';

    setScrapingProduct(true);
    setScrapingProgress({
      totalStores: method === 'google-shopping' ? 1 : 7,
      completedStores: 0,
      failedStores: 0,
      totalProducts: 0,
    });

    try {
      const result = await scrapeIngredientAsync(
        ingredient.name,
        ingredient.id,
        (progress) => {
          setScrapingProgress(progress);
        },
        method
      );

      setScrapingProduct(false);
      setScrapingProgress(null);

      if (result.success) {
        Alert.alert(
          'Scraping terminé',
          `${result.totalProducts} produit(s) trouvé(s) pour "${ingredient.name}" via ${methodName}`
        );
        await loadIngredient();
      } else {
        Alert.alert('Erreur', result.error || 'Aucun produit trouvé');
      }
    } catch (error: any) {
      setScrapingProduct(false);
      setScrapingProgress(null);
      Alert.alert('Erreur', error.message || 'Le scraping a échoué');
    }
  };

  // Fonction pour extraire la quantité et l'unité d'un produit
  const extractQuantityAndUnit = (quantityStr: string | null, parsedQuantity: number | null): { quantity: number; unit: string } | null => {
    if (!quantityStr) return null;

    const quantityText = quantityStr.toLowerCase().trim();
    
    // Essayer de parser depuis le texte avec patterns améliorés
    const kgMatch = quantityText.match(/([0-9]+[,.]?[0-9]*)\s*kg/);
    const gMatch = quantityText.match(/([0-9]+[,.]?[0-9]*)\s*g(?!ousse)/); // Exclure "gousse"
    const lMatch = quantityText.match(/([0-9]+[,.]?[0-9]*)\s*l(?!itre)?(?:\s|$)/);
    const mlMatch = quantityText.match(/([0-9]+[,.]?[0-9]*)\s*ml/);
    const unMatch = quantityText.match(/([0-9]+)\s*(un|unité)/);
    
    // Retourner l'unité TELLE QUELLE (kg au lieu de convertir en g)
    if (kgMatch) {
      return { quantity: parseFloat(kgMatch[1].replace(',', '.')), unit: 'kg' };
    } else if (gMatch) {
      return { quantity: parseFloat(gMatch[1].replace(',', '.')), unit: 'g' };
    } else if (lMatch) {
      return { quantity: parseFloat(lMatch[1].replace(',', '.')), unit: 'L' };
    } else if (mlMatch) {
      return { quantity: parseFloat(mlMatch[1].replace(',', '.')), unit: 'ml' };
    } else if (unMatch) {
      return { quantity: parseFloat(unMatch[1]), unit: 'unité' };
    }
    
    // Fallback sur parsedQuantity si disponible
    if (parsedQuantity) {
      // Déterminer l'unité basée sur le texte
      if (quantityText.includes('kg')) {
        return { quantity: parsedQuantity, unit: 'kg' };
      } else if (quantityText.includes('g')) {
        return { quantity: parsedQuantity, unit: 'g' };
      } else if (quantityText.includes('l') && !quantityText.includes('ml')) {
        return { quantity: parsedQuantity, unit: 'L' };
      } else if (quantityText.includes('ml')) {
        return { quantity: parsedQuantity, unit: 'ml' };
      } else {
        return { quantity: parsedQuantity, unit: 'unité' };
      }
    }
    
    return null;
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

  if (!ingredient) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Ingrédient introuvable</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>{ingredient.name}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Informations générales */}
        <View style={styles.infoCard}>
          <Text style={styles.cardTitle}>Informations générales</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Unité de base:</Text>
            <Text style={styles.infoValue}>{ingredient.unit}</Text>
          </View>
          {ingredient.category && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Catégorie:</Text>
              <Text style={styles.infoValue}>{ingredient.category}</Text>
            </View>
          )}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Utilisé dans:</Text>
            <Text style={styles.infoValue}>{ingredient.usageCount} recette(s)</Text>
          </View>
        </View>

        {/* Section Conversions multiples */}
        <View style={styles.infoCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Conversions</Text>
            <Pressable
              style={[styles.addKeywordButton, { backgroundColor: colors.primary }]}
              onPress={() => setShowAddConversionForm(!showAddConversionForm)}
            >
              <MaterialIcons 
                name={showAddConversionForm ? "close" : "add"} 
                size={20} 
                color={colors.surface} 
              />
            </Pressable>
          </View>

          <Text style={styles.infoText}>
            🔄 Définissez les conversions depuis l'unité de base ({ingredient.unit}). Ex: pour "ail" en gousse → 1 gousse = 10 g, 1 gousse = 0.17 tête.
          </Text>

          {showAddConversionForm && (
            <View style={styles.conversionForm}>
              <View style={styles.conversionFormRow}>
                <Text style={styles.conversionFormLabel}>1 {ingredient.unit} =</Text>
                <TextInput
                  style={styles.conversionFactorInput}
                  placeholder="10"
                  value={newConversionFactor}
                  onChangeText={setNewConversionFactor}
                  keyboardType="decimal-pad"
                />
                <Pressable
                  style={styles.conversionUnitSelector}
                  onPress={() => setShowConversionUnitModal(true)}
                >
                  <Text style={[styles.conversionUnitSelectorText, !newConversionFromUnit && styles.conversionUnitSelectorPlaceholder]}>
                    {newConversionFromUnit || 'Unité...'}
                  </Text>
                  <MaterialIcons name="arrow-drop-down" size={20} color={colors.primary} />
                </Pressable>
              </View>
              <Pressable
                style={[styles.keywordFormButton, addingConversion && styles.buttonDisabled]}
                onPress={handleAddConversion}
                disabled={addingConversion}
              >
                {addingConversion ? (
                  <ActivityIndicator size="small" color={colors.surface} />
                ) : (
                  <Text style={styles.keywordFormButtonText}>Ajouter</Text>
                )}
              </Pressable>
            </View>
          )}

          {conversions.length === 0 ? (
            <Text style={styles.emptyText}>
              Aucune conversion configurée. Cliquez sur + pour en ajouter.
            </Text>
          ) : (
            <View style={styles.conversionsList}>
              {conversions.map((conv) => {
                const isEditing = editingConversionId === conv.id;
                
                return (
                  <View key={conv.id} style={styles.conversionChip}>
                    {isEditing ? (
                      <>
                        <View style={styles.conversionEditRow}>
                          <Text style={styles.conversionEditLabel}>1 {ingredient.unit} =</Text>
                          <TextInput
                            style={styles.conversionEditFactorInput}
                            value={editConversionFactor}
                            onChangeText={setEditConversionFactor}
                            keyboardType="decimal-pad"
                          />
                          <TextInput
                            style={styles.conversionEditUnitInput}
                            value={editConversionUnit}
                            onChangeText={setEditConversionUnit}
                          />
                        </View>
                        <View style={styles.conversionEditActions}>
                          <Pressable
                            style={[styles.conversionSaveButton, savingEditConversion && styles.buttonDisabled]}
                            onPress={handleSaveEditConversion}
                            disabled={savingEditConversion}
                          >
                            {savingEditConversion ? (
                              <ActivityIndicator size="small" color={colors.surface} />
                            ) : (
                              <MaterialIcons name="check" size={16} color={colors.surface} />
                            )}
                          </Pressable>
                          <Pressable
                            style={styles.conversionCancelButton}
                            onPress={cancelEditConversion}
                          >
                            <MaterialIcons name="close" size={16} color={colors.error} />
                          </Pressable>
                        </View>
                      </>
                    ) : (
                      <>
                        <Text style={styles.conversionChipText}>
                          1 {ingredient.unit} = {(1 / conv.toBaseUnitFactor).toFixed(2)} {conv.fromUnit}
                        </Text>
                        <View style={styles.conversionChipActions}>
                          <Pressable
                            onPress={() => startEditConversion(conv)}
                            style={styles.conversionEditButton}
                          >
                            <MaterialIcons name="edit" size={14} color={colors.primary} />
                          </Pressable>
                          <Pressable
                            onPress={() => handleRemoveConversion(conv.id, conv.fromUnit)}
                            disabled={removingConversion === conv.id}
                            style={styles.keywordRemoveButton}
                          >
                            {removingConversion === conv.id ? (
                              <ActivityIndicator size="small" color={colors.error} />
                            ) : (
                              <MaterialIcons name="close" size={14} color={colors.error} />
                            )}
                          </Pressable>
                        </View>
                      </>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Section Mots-clés d'EXCLUSION */}
        <View style={styles.infoCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Mots-clés à EXCLURE</Text>
            <Pressable
              style={[styles.addKeywordButton, { backgroundColor: colors.error }]}
              onPress={() => setShowAddExclusionForm(!showAddExclusionForm)}
            >
              <MaterialIcons 
                name={showAddExclusionForm ? "close" : "add"} 
                size={20} 
                color={colors.surface} 
              />
            </Pressable>
          </View>

          <Text style={styles.infoText}>
            ❌ Excluez des mots-clés pour affiner le matching. Ex: pour "fromage", excluez "cheddar" ou "mozzarella" pour ne matcher que du fromage générique.
          </Text>

          {showAddExclusionForm && (
            <View style={styles.keywordForm}>
              <TextInput
                style={styles.keywordInput}
                placeholder="Ex: cheddar, bio, sans lactose..."
                value={newExclusionKeyword}
                onChangeText={setNewExclusionKeyword}
                autoCapitalize="none"
                autoFocus
              />
              <Pressable
                style={[styles.keywordFormButton, addingExclusion && styles.buttonDisabled]}
                onPress={handleAddExclusion}
                disabled={addingExclusion || !newExclusionKeyword.trim()}
              >
                {addingExclusion ? (
                  <ActivityIndicator size="small" color={colors.surface} />
                ) : (
                  <Text style={styles.keywordFormButtonText}>Ajouter</Text>
                )}
              </Pressable>
            </View>
          )}

          {exclusionKeywords.length === 0 ? (
            <Text style={styles.emptyText}>
              Aucun mot-clé exclu. Cliquez sur + pour en ajouter.
            </Text>
          ) : (
            <View style={styles.keywordsList}>
              {exclusionKeywords.map((kw) => (
                <View key={kw.id} style={[styles.keywordChip, { borderColor: colors.error }]}>
                  <Text style={styles.keywordChipText}>{kw.keyword}</Text>
                  <Pressable
                    onPress={() => handleRemoveExclusion(kw.id, kw.keyword)}
                    disabled={removingExclusion === kw.id}
                    style={styles.keywordRemoveButton}
                  >
                    {removingExclusion === kw.id ? (
                      <ActivityIndicator size="small" color={colors.error} />
                    ) : (
                      <MaterialIcons name="close" size={16} color={colors.error} />
                    )}
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Section Mots-clés d'INCLUSION */}
        <View style={styles.infoCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Mots-clés OBLIGATOIRES</Text>
            <Pressable
              style={[styles.addKeywordButton, { backgroundColor: colors.success }]}
              onPress={() => setShowAddInclusionForm(!showAddInclusionForm)}
            >
              <MaterialIcons 
                name={showAddInclusionForm ? "close" : "add"} 
                size={20} 
                color={colors.surface} 
              />
            </Pressable>
          </View>

          <Text style={styles.infoText}>
            ✅ Exigez des mots-clés pour restreindre le matching. Le produit doit contenir AU MOINS UN des mots-clés (OU logique). Ex: pour "ail", ajoutez "ail" ET "garlic" pour accepter les produits en français ou anglais.
          </Text>

          {showAddInclusionForm && (
            <View style={styles.keywordForm}>
              <TextInput
                style={styles.keywordInput}
                placeholder="Ex: végétale, biologique..."
                value={newInclusionKeyword}
                onChangeText={setNewInclusionKeyword}
                autoCapitalize="none"
                autoFocus
              />
              <Pressable
                style={[styles.keywordFormButton, addingInclusion && styles.buttonDisabled]}
                onPress={handleAddInclusion}
                disabled={addingInclusion || !newInclusionKeyword.trim()}
              >
                {addingInclusion ? (
                  <ActivityIndicator size="small" color={colors.surface} />
                ) : (
                  <Text style={styles.keywordFormButtonText}>Ajouter</Text>
                )}
              </Pressable>
            </View>
          )}

          {inclusionKeywords.length === 0 ? (
            <Text style={styles.emptyText}>
              Aucun mot-clé obligatoire. Cliquez sur + pour en ajouter.
            </Text>
          ) : (
            <View style={styles.keywordsList}>
              {inclusionKeywords.map((kw) => (
                <View key={kw.id} style={[styles.keywordChip, { borderColor: colors.success }]}>
                  <Text style={styles.keywordChipText}>{kw.keyword}</Text>
                  <Pressable
                    onPress={() => handleRemoveInclusion(kw.id, kw.keyword)}
                    disabled={removingInclusion === kw.id}
                    style={styles.keywordRemoveButton}
                  >
                    {removingInclusion === kw.id ? (
                      <ActivityIndicator size="small" color={colors.success} />
                    ) : (
                      <MaterialIcons name="close" size={16} color={colors.success} />
                    )}
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Produits associés */}
        <View style={styles.infoCard}>
          <View style={styles.productsSectionHeader}>
            <Text style={styles.cardTitle}>
              Produits d'épicerie associés ({ingredient.prices?.length || 0})
            </Text>
            <View style={styles.productsSectionActions}>
              <Pressable
                style={[styles.scrapeProductButton, scrapingProduct && styles.buttonDisabled]}
                onPress={handleScrapeProduct}
                disabled={scrapingProduct}
              >
                {scrapingProduct ? (
                  <ActivityIndicator size="small" color={colors.surface} />
                ) : (
                  <>
                    <MaterialIcons name="sync" size={18} color={colors.surface} />
                    <Text style={styles.scrapeProductButtonText}>Scraper</Text>
                  </>
                )}
              </Pressable>
              
              {ingredient.prices && ingredient.prices.some(p => !p.quantity || p.quantity.trim() === '') && (
                <Pressable
                  style={[styles.completeFormatsButton, completingFormats && styles.buttonDisabled]}
                  onPress={handleCompleteMissingFormats}
                  disabled={completingFormats}
                >
                  {completingFormats ? (
                    <ActivityIndicator size="small" color={colors.surface} />
                  ) : (
                    <>
                      <MaterialIcons name="auto-fix-high" size={18} color={colors.surface} />
                      <Text style={styles.completeFormatsButtonText}>Compléter</Text>
                    </>
                  )}
                </Pressable>
              )}
            </View>
          </View>
          
          {scrapingProduct && scrapingProgress && (
            <View style={styles.scrapingProgressBox}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.scrapingProgressText}>
                {scrapingProgress.currentStore 
                  ? `Scraping ${scrapingProgress.currentStore}... (${scrapingProgress.completedStores + 1}/${scrapingProgress.totalStores})`
                  : `Préparation... (0/${scrapingProgress.totalStores})`
                }
              </Text>
              <Text style={styles.scrapingProgressCount}>
                {scrapingProgress.totalProducts} produit(s) trouvé(s)
              </Text>
            </View>
          )}
          
          {completingFormats && jobStatus && (
            <View style={styles.completingProgressBox}>
              <ActivityIndicator size="small" color={colors.accent} />
              <View style={{ flex: 1 }}>
                <Text style={styles.completingProgressText}>
                  Complétion des formats en arrière-plan...
                </Text>
                <Text style={styles.completingProgressStatus}>
                  Statut: {jobStatus.status === 'processing' ? '⚙️ En cours' : '⏳ En attente'}
                </Text>
                <Text style={styles.completingProgressCount}>
                  {jobStatus.productsUpdated} format(s) récupéré(s) sur {jobStatus.productsProcessed} traité(s)
                </Text>
                {jobStatus.productsRemaining > 0 && (
                  <Text style={[styles.completingProgressCount, { fontSize: 10, marginTop: 4 }]}>
                    📊 ~{jobStatus.productsRemaining} produit(s) restant(s)
                  </Text>
                )}
                <Pressable
                  style={styles.cancelJobButton}
                  onPress={handleCancelJob}
                >
                  <Text style={styles.cancelJobButtonText}>Annuler</Text>
                </Pressable>
              </View>
            </View>
          )}
          
          {!ingredient.prices || ingredient.prices.length === 0 ? (
            <Text style={styles.emptyText}>
              Aucun produit associé. Cliquez sur "Scraper" pour rechercher automatiquement.
            </Text>
          ) : (
            // Grouper les prix par magasin
            Object.values(
              ingredient.prices.reduce((acc, price) => {
                if (!acc[price.storeCode]) {
                  acc[price.storeCode] = {
                    storeCode: price.storeCode,
                    storeName: price.storeName,
                    storeColor: price.storeColor,
                    products: [],
                  };
                }
                acc[price.storeCode].products.push(price);
                return acc;
              }, {} as Record<string, { storeCode: string; storeName: string; storeColor: string; products: typeof ingredient.prices }>)
            ).map((store) => {
              // Trouver le produit le moins cher par unité dans ce magasin
              let bestDeal: { price: typeof ingredient.prices[0]; pricePerUnit: number } | null = null;
              
              store.products.forEach((price) => {
                const actualPrice = price.isOnSale && price.salePrice ? price.salePrice : price.regularPrice;
                let extracted = extractQuantityAndUnit(price.quantity, price.parsedQuantity);
                
                if (!extracted && price.productName) {
                  extracted = extractQuantityAndUnit(price.productName, price.parsedQuantity);
                }
                
                const pricePerUnit = extracted && conversions.length > 0
                  ? calculatePricePerBaseUnit(actualPrice, extracted.quantity, extracted.unit, conversions)
                  : null;
                
                if (pricePerUnit !== null) {
                  if (!bestDeal || pricePerUnit < bestDeal.pricePerUnit) {
                    bestDeal = { price, pricePerUnit };
                  }
                }
              });

              return (
                <View key={store.storeCode} style={styles.storeCard}>
                  <View style={[styles.storeHeader, { backgroundColor: store.storeColor }]}>
                    <Text style={styles.storeHeaderText}>{store.storeName}</Text>
                    <Text style={styles.storeHeaderCount}>{store.products.length} produit(s)</Text>
                  </View>
                  
                  <View style={styles.storeProducts}>
                    {store.products.map((price, idx) => {
                      const actualPrice = price.isOnSale && price.salePrice ? price.salePrice : price.regularPrice;
                      let extracted = extractQuantityAndUnit(price.quantity, price.parsedQuantity);
                      
                      if (!extracted && price.productName) {
                        extracted = extractQuantityAndUnit(price.productName, price.parsedQuantity);
                      }
                      
                      const pricePerUnit = extracted && conversions.length > 0
                        ? calculatePricePerBaseUnit(actualPrice, extracted.quantity, extracted.unit, conversions)
                        : null;
                      
                      const isBestDeal = bestDeal && bestDeal.price.priceId === price.priceId;

                      return (
                        <Pressable 
                          key={idx} 
                          style={[styles.storeProductRow, isBestDeal && styles.storeProductRowBest]}
                          onPress={() => {
                            setSelectedProductId(price.productId);
                            setShowProductDetailModal(true);
                          }}
                        >
                          {isBestDeal && (
                            <View style={styles.bestDealBadge}>
                              <MaterialIcons name="stars" size={14} color={colors.accent} />
                            </View>
                          )}
                          <View style={styles.storeProductInfo}>
                            <Text style={[styles.storeProductName, isBestDeal && styles.storeProductNameBest]}>
                              {price.productName}
                            </Text>
                            {price.quantity && (
                              <Text style={styles.storeProductQuantity}>{price.quantity}</Text>
                            )}
                          </View>
                          <View style={styles.storeProductPrices}>
                            <View style={styles.storeProductPriceRow}>
                              <Text style={[styles.storeProductRegularPrice, price.isOnSale && styles.storeProductRegularPriceStrike]}>
                                {price.regularPrice.toFixed(2)}$
                              </Text>
                              {price.isOnSale && price.salePrice && (
                                <Text style={styles.storeProductSalePrice}>
                                  {price.salePrice.toFixed(2)}$
                                </Text>
                              )}
                            </View>
                            {pricePerUnit !== null && (
                              <Text style={[styles.storeProductUnitPrice, isBestDeal && styles.storeProductUnitPriceBest]}>
                                {pricePerUnit.toFixed(2)}$/{ingredient.unit}
                              </Text>
                            )}
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Modal de détail produit */}
      <Modal
        visible={showProductDetailModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowProductDetailModal(false)}
      >
        <View style={styles.productDetailModalOverlay}>
          <View style={styles.productDetailModalContent}>
            <View style={styles.productDetailModalHeader}>
              <Text style={styles.productDetailModalTitle} numberOfLines={2}>
                {selectedProductId && ingredient.prices?.find(p => p.productId === selectedProductId)?.productName}
              </Text>
              <Pressable
                onPress={() => setShowProductDetailModal(false)}
                style={styles.productDetailModalCloseButton}
              >
                <MaterialIcons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>

            <ScrollView style={styles.productDetailModalScroll}>
              {selectedProductId && ingredient.prices?.filter(p => p.productId === selectedProductId).map((price, idx) => {
                const isEditing = editingPriceId === price.priceId;
                const actualPrice = price.isOnSale && price.salePrice ? price.salePrice : price.regularPrice;
                let extracted = extractQuantityAndUnit(price.quantity, price.parsedQuantity);
                
                // Si échec, essayer depuis le nom du produit
                if (!extracted && price.productName) {
                  extracted = extractQuantityAndUnit(price.productName, price.parsedQuantity);
                }
                
                // Calculer le prix par unité de base
                let pricePerBaseUnit: number | null = null;
                if (extracted && conversions.length > 0) {
                  pricePerBaseUnit = calculatePricePerBaseUnit(
                    actualPrice,
                    extracted.quantity,
                    extracted.unit,
                    conversions
                  );
                }
                
                return (
                <View key={idx} style={styles.productDetailStoreCard}>
                  <View style={styles.productDetailStoreHeader}>
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                      <View style={[styles.productDetailStoreChip, { backgroundColor: price.storeColor }]}>
                        <Text style={styles.productDetailStoreChipText}>{price.storeName}</Text>
                      </View>
                      {price.isOnSale && (
                        <View style={styles.productDetailSaleBadge}>
                          <MaterialIcons name="local-offer" size={14} color={colors.surface} />
                          <Text style={styles.productDetailSaleBadgeText}>SPÉCIAL</Text>
                        </View>
                      )}
                    </View>
                    {!isEditing ? (
                      <Pressable
                        style={styles.editPriceButton}
                        onPress={() => handleEditPrice(price)}
                      >
                        <MaterialIcons name="edit" size={18} color={colors.primary} />
                      </Pressable>
                    ) : (
                      <View style={styles.editActions}>
                        <Pressable
                          style={[styles.saveEditButton, savingPrice && styles.buttonDisabled]}
                          onPress={handleSavePrice}
                          disabled={savingPrice}
                        >
                          {savingPrice ? (
                            <ActivityIndicator size="small" color={colors.surface} />
                          ) : (
                            <MaterialIcons name="check" size={18} color={colors.surface} />
                          )}
                        </Pressable>
                        <Pressable
                          style={styles.cancelEditButton}
                          onPress={handleCancelEdit}
                        >
                          <MaterialIcons name="close" size={18} color={colors.error} />
                        </Pressable>
                      </View>
                    )}
                  </View>

                  {isEditing ? (
                    <View style={styles.editFormSection}>
                      <Text style={styles.editFormTitle}>Modifier les informations</Text>
                      
                      <View style={styles.editFormRow}>
                        <Text style={styles.editFormLabel}>Prix régulier ($):</Text>
                        <TextInput
                          style={styles.editFormInput}
                          value={editRegularPrice}
                          onChangeText={setEditRegularPrice}
                          keyboardType="decimal-pad"
                          placeholder="Ex: 6.99"
                          placeholderTextColor={colors.textSecondary}
                        />
                      </View>

                      <View style={styles.editFormRow}>
                        <Text style={styles.editFormLabel}>Prix en rabais ($):</Text>
                        <TextInput
                          style={styles.editFormInput}
                          value={editSalePrice}
                          onChangeText={setEditSalePrice}
                          keyboardType="decimal-pad"
                          placeholder="Ex: 4.99 (optionnel)"
                          placeholderTextColor={colors.textSecondary}
                        />
                      </View>

                      <View style={styles.editFormRow}>
                        <View style={styles.editFormSwitchRow}>
                          <Text style={styles.editFormLabel}>En rabais:</Text>
                          <Switch
                            value={editIsOnSale}
                            onValueChange={setEditIsOnSale}
                            trackColor={{ false: colors.border, true: colors.primary }}
                            thumbColor={colors.surface}
                          />
                        </View>
                      </View>
                      
                      <View style={styles.editFormRow}>
                        <Text style={styles.editFormLabel}>Quantité:</Text>
                        <TextInput
                          style={styles.editFormInput}
                          value={editParsedQuantity}
                          onChangeText={setEditParsedQuantity}
                          keyboardType="decimal-pad"
                          placeholder="Ex: 250, 1180, 3"
                          placeholderTextColor={colors.textSecondary}
                        />
                      </View>

                      <View style={styles.editFormRow}>
                        <Text style={styles.editFormLabel}>Unité:</Text>
                        <View style={{ flex: 1 }}>
                          <Pressable
                            style={styles.unitTypeSelector}
                            onPress={() => setShowUnitDropdown(!showUnitDropdown)}
                          >
                            <Text style={styles.unitTypeSelectorText}>
                              {editUnit}
                            </Text>
                            <MaterialIcons 
                              name={showUnitDropdown ? "arrow-drop-up" : "arrow-drop-down"} 
                              size={20} 
                              color={colors.primary} 
                            />
                          </Pressable>
                          
                          {showUnitDropdown && (
                            <View style={styles.unitDropdownList}>
                              <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                                {AVAILABLE_UNITS.map((unit) => (
                                  <Pressable
                                    key={unit}
                                    style={[
                                      styles.unitDropdownOption,
                                      editUnit === unit && styles.unitDropdownOptionSelected
                                    ]}
                                    onPress={() => {
                                      setEditUnit(unit);
                                      
                                      // Déduire automatiquement le type d'unité
                                      if (['g', 'kg'].includes(unit)) {
                                        setEditUnitType('kg');
                                      } else if (['ml', 'L'].includes(unit)) {
                                        setEditUnitType('L');
                                      } else {
                                        setEditUnitType('unit');
                                      }
                                      
                                      setShowUnitDropdown(false);
                                    }}
                                  >
                                    <Text style={[
                                      styles.unitDropdownOptionText,
                                      editUnit === unit && styles.unitDropdownOptionTextSelected
                                    ]}>
                                      {unit}
                                    </Text>
                                    {editUnit === unit && (
                                      <MaterialIcons name="check" size={18} color={colors.primary} />
                                    )}
                                  </Pressable>
                                ))}
                              </ScrollView>
                            </View>
                          )}
                        </View>
                      </View>

                      <View style={styles.editFormRow}>
                        <Text style={styles.editFormLabel}>Marque:</Text>
                        <TextInput
                          style={styles.editFormInput}
                          value={editBrand}
                          onChangeText={setEditBrand}
                          placeholder="Ex: Liberté, Oikos, Iögo"
                          placeholderTextColor={colors.textSecondary}
                          autoCapitalize="words"
                        />
                      </View>

                      <View style={styles.editFormRow}>
                        <Text style={styles.editFormLabel}>URL du produit:</Text>
                        <TextInput
                          style={styles.editFormInput}
                          value={editScrapeUrl}
                          onChangeText={setEditScrapeUrl}
                          placeholder="https://example.com/produit"
                          placeholderTextColor={colors.textSecondary}
                          autoCapitalize="none"
                          autoCorrect={false}
                          keyboardType="url"
                        />
                      </View>
                    </View>
                  ) : (
                    <>
                      {price.quantity ? (
                        <View style={styles.productDetailRow}>
                          <MaterialIcons name="inventory-2" size={18} color={colors.textSecondary} />
                          <Text style={styles.productDetailLabel}>Format:</Text>
                          <Text style={styles.productDetailValue}>{price.quantity}</Text>
                        </View>
                      ) : (
                        <View style={styles.productDetailRow}>
                          <MaterialIcons name="warning" size={18} color={colors.warning} />
                          <Text style={[styles.productDetailLabel, { color: colors.warning }]}>Format manquant</Text>
                          {price.scrapeUrl && price.scrapeUrl.startsWith('http') && !price.scrapeUrl.includes('google.ca/search') && !price.scrapeUrl.includes('google.com/search') ? (
                            <Pressable
                              style={[styles.extractQuantityButton, extractingQuantityForId === price.priceId && styles.buttonDisabled]}
                              onPress={() => handleExtractQuantity(price.priceId, price.scrapeUrl!)}
                              disabled={extractingQuantityForId === price.priceId}
                            >
                              {extractingQuantityForId === price.priceId ? (
                                <ActivityIndicator size="small" color={colors.surface} />
                              ) : (
                                <>
                                  <MaterialIcons name="search" size={14} color={colors.surface} />
                                  <Text style={styles.extractQuantityButtonText}>Récupérer</Text>
                                </>
                              )}
                            </Pressable>
                          ) : (
                            <Text style={[styles.productDetailValue, { fontSize: 10, color: colors.textSecondary }]}>
                              (Pas d'URL directe disponible)
                            </Text>
                          )}
                        </View>
                      )}

                      <View style={styles.productDetailRow}>
                        <MaterialIcons name="attach-money" size={18} color={colors.textSecondary} />
                        <Text style={styles.productDetailLabel}>Prix régulier:</Text>
                        <Text style={[styles.productDetailValue, price.isOnSale && styles.productDetailValueStrike]}>
                          {price.regularPrice.toFixed(2)}$
                        </Text>
                      </View>

                      {price.isOnSale && price.salePrice && (
                        <View style={styles.productDetailRow}>
                          <MaterialIcons name="local-offer" size={18} color={colors.error} />
                          <Text style={styles.productDetailLabel}>Prix réduit:</Text>
                          <Text style={[styles.productDetailValue, { color: colors.error, fontWeight: '700' }]}>
                            {price.salePrice.toFixed(2)}$
                          </Text>
                        </View>
                      )}

                      {pricePerBaseUnit !== null && (
                        <View style={styles.productDetailRow}>
                          <MaterialIcons name="calculate" size={18} color={colors.primary} />
                          <Text style={styles.productDetailLabel}>Prix par {ingredient.unit}:</Text>
                          <Text style={[styles.productDetailValue, { color: colors.primary, fontWeight: '700' }]}>
                            {pricePerBaseUnit.toFixed(2)}$
                          </Text>
                        </View>
                      )}

                      {price.scrapeUrl && (
                        <Pressable 
                          style={styles.productDetailRow}
                          onPress={() => {
                            if (price.scrapeUrl && price.scrapeUrl.startsWith('http')) {
                              Linking.openURL(price.scrapeUrl).catch(() => {
                                Alert.alert('Erreur', "Impossible d'ouvrir le lien");
                              });
                            }
                          }}
                        >
                          <MaterialIcons name="link" size={18} color={colors.primary} />
                          <Text style={styles.productDetailLabel}>Source:</Text>
                          <Text style={[styles.productDetailValue, styles.productDetailLink]} numberOfLines={1}>
                            {price.scrapeUrl}
                          </Text>
                          <MaterialIcons name="open-in-new" size={16} color={colors.primary} style={{ marginLeft: spacing.xs }} />
                        </Pressable>
                      )}

                      <View style={styles.productDetailRow}>
                        <MaterialIcons name="update" size={18} color={colors.textSecondary} />
                        <Text style={styles.productDetailLabel}>Mis à jour:</Text>
                        <Text style={styles.productDetailValue}>
                          {new Date(price.lastUpdated).toLocaleDateString('fr-CA')}
                        </Text>
                      </View>
                    </>
                  )}
                </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>



      {/* Modal de sélection d'unité pour conversion */}
      <Modal
        visible={showConversionUnitModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowConversionUnitModal(false)}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={() => setShowConversionUnitModal(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Sélectionner une unité</Text>
            <ScrollView style={styles.unitList}>
              {AVAILABLE_UNITS.map((unit) => (
                <Pressable
                  key={unit}
                  style={[
                    styles.unitOption,
                    newConversionFromUnit === unit && styles.unitOptionSelected
                  ]}
                  onPress={() => {
                    setNewConversionFromUnit(unit);
                    setShowConversionUnitModal(false);
                  }}
                >
                  <Text style={[
                    styles.unitOptionText,
                    newConversionFromUnit === unit && styles.unitOptionTextSelected
                  ]}>
                    {unit}
                  </Text>
                  {newConversionFromUnit === unit && (
                    <MaterialIcons name="check" size={20} color={colors.primary} />
                  )}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    ...typography.h2,
    color: colors.text,
    flex: 1,
    marginLeft: spacing.md,
  },
  content: {
    flex: 1,
    padding: spacing.md,
  },
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  cardTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  addKeywordButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoText: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  infoLabel: {
    ...typography.bodyBold,
    color: colors.text,
    width: 120,
  },
  infoValue: {
    ...typography.body,
    color: colors.textSecondary,
    flex: 1,
  },
  keywordForm: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  keywordInput: {
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
  keywordFormButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 80,
  },
  keywordFormButtonText: {
    ...typography.bodyBold,
    color: colors.surface,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  keywordsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  keywordChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.xs,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
    gap: spacing.xs,
  },
  keywordChipText: {
    ...typography.caption,
    color: colors.text,
  },
  keywordRemoveButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  productCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    ...typography.bodyBold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  productPrices: {
    gap: spacing.xs,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: spacing.xs,
  },
  priceStoreInfo: {
    flex: 1,
    gap: 2,
  },
  priceStore: {
    ...typography.caption,
    color: colors.text,
    fontWeight: '600',
  },
  priceQuantity: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 11,
  },
  priceValues: {
    alignItems: 'flex-end',
    gap: 2,
  },
  priceMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  regularPrice: {
    ...typography.caption,
    color: colors.text,
  },
  regularPriceStrike: {
    textDecorationLine: 'line-through',
    color: colors.textSecondary,
  },
  salePrice: {
    ...typography.caption,
    color: colors.error,
    fontWeight: '700',
  },
  unitPrice: {
    ...typography.caption,
    color: colors.primary,
    fontSize: 11,
    fontWeight: '600',
  },
  conversionForm: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  conversionFormRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  conversionFormLabel: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  conversionUnitSelector: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  conversionUnitSelectorText: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
  },
  conversionUnitSelectorPlaceholder: {
    color: colors.textSecondary,
    fontWeight: '400',
  },
  conversionFactorInput: {
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
  conversionsList: {
    gap: spacing.sm,
  },
  conversionChip: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  conversionChipText: {
    ...typography.body,
    color: colors.text,
  },
  conversionChipActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  conversionEditButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  conversionEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  conversionEditLabel: {
    ...typography.caption,
    color: colors.text,
    fontWeight: '600',
  },
  conversionEditUnitInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    ...typography.caption,
    color: colors.text,
  },
  conversionEditFactorInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    ...typography.caption,
    color: colors.text,
  },
  conversionEditActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  conversionSaveButton: {
    backgroundColor: colors.success,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    width: 32,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  conversionCancelButton: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.error,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    width: 32,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    width: '80%',
    maxHeight: '70%',
  },
  modalTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.md,
  },
  unitDropdownList: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: borderRadius.md,
    marginTop: spacing.xs,
    maxHeight: 200,
    zIndex: 1000,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  unitDropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  unitDropdownOptionSelected: {
    backgroundColor: colors.background,
  },
  unitDropdownOptionText: {
    ...typography.body,
    color: colors.text,
  },
  unitDropdownOptionTextSelected: {
    ...typography.bodyBold,
    color: colors.primary,
  },
  unitList: {
    paddingHorizontal: spacing.lg,
  },
  unitOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  unitOptionSelected: {
    backgroundColor: colors.background,
  },
  unitOptionText: {
    ...typography.body,
    color: colors.text,
  },
  unitOptionTextSelected: {
    ...typography.bodyBold,
    color: colors.primary,
  },
  productDetailModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  productDetailModalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '90%',
    paddingBottom: spacing.xl,
  },
  productDetailModalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  productDetailModalTitle: {
    ...typography.h3,
    color: colors.text,
    flex: 1,
    marginRight: spacing.md,
  },
  productDetailModalCloseButton: {
    padding: spacing.xs,
  },
  productDetailModalScroll: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  productDetailStoreCard: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  productDetailStoreHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  productDetailStoreChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  productDetailStoreChipText: {
    ...typography.caption,
    color: colors.surface,
    fontWeight: '700',
  },
  productDetailSaleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.error,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    gap: 4,
  },
  productDetailSaleBadgeText: {
    ...typography.caption,
    color: colors.surface,
    fontWeight: '700',
    fontSize: 10,
  },
  productDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  productDetailLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    flex: 1,
  },
  productDetailValue: {
    ...typography.caption,
    color: colors.text,
    fontWeight: '600',
  },
  productDetailValueStrike: {
    textDecorationLine: 'line-through',
    color: colors.textSecondary,
    fontWeight: '400',
  },
  productDetailLink: {
    color: colors.primary,
    fontSize: 10,
  },
  editPriceButton: {
    padding: spacing.xs,
  },
  editActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  saveEditButton: {
    backgroundColor: colors.success,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    minWidth: 36,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelEditButton: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.error,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    minWidth: 36,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editFormSection: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  editFormTitle: {
    ...typography.bodyBold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  editFormRow: {
    marginBottom: spacing.md,
  },
  editFormLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  editFormSwitchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flex: 1,
  },
  editFormInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.body,
    color: colors.text,
  },
  unitTypeSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  unitTypeSelectorText: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
  },
  productsSectionHeader: {
    flexDirection: 'column',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  productsSectionActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  scrapeProductButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  scrapeProductButtonText: {
    ...typography.caption,
    color: colors.surface,
    fontWeight: '700',
    fontSize: 12,
  },
  completeFormatsButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  completeFormatsButtonText: {
    ...typography.caption,
    color: colors.surface,
    fontWeight: '700',
    fontSize: 12,
  },
  scrapingProgressBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  scrapingProgressText: {
    ...typography.caption,
    color: colors.text,
    flex: 1,
  },
  scrapingProgressCount: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  completingProgressBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFF9E6',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
    borderLeftWidth: 4,
    borderLeftColor: colors.accent,
  },
  completingProgressText: {
    ...typography.caption,
    color: colors.text,
    fontWeight: '600',
  },
  completingProgressStatus: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
    fontWeight: '600',
  },
  cancelJobButton: {
    backgroundColor: colors.error,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: borderRadius.sm,
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
  },
  cancelJobButtonText: {
    ...typography.caption,
    color: colors.surface,
    fontWeight: '700',
    fontSize: 11,
  },
  completingProgressCount: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  storeCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  storeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  storeHeaderText: {
    ...typography.bodyBold,
    color: colors.surface,
    fontSize: 16,
  },
  storeHeaderCount: {
    ...typography.caption,
    color: colors.surface,
    fontSize: 12,
  },
  storeProducts: {
    backgroundColor: colors.background,
  },
  storeProductRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    position: 'relative',
  },
  storeProductRowBest: {
    backgroundColor: '#FFF9E6',
    borderLeftWidth: 4,
    borderLeftColor: colors.accent,
  },
  bestDealBadge: {
    position: 'absolute',
    top: spacing.xs,
    left: spacing.xs,
  },
  storeProductInfo: {
    flex: 1,
    paddingRight: spacing.sm,
    paddingLeft: spacing.sm,
  },
  storeProductName: {
    ...typography.body,
    color: colors.text,
    marginBottom: 2,
  },
  storeProductNameBest: {
    ...typography.bodyBold,
    color: colors.text,
  },
  storeProductQuantity: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 11,
  },
  storeProductPrices: {
    alignItems: 'flex-end',
  },
  storeProductPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: 2,
  },
  storeProductRegularPrice: {
    ...typography.body,
    color: colors.text,
    fontSize: 14,
  },
  storeProductRegularPriceStrike: {
    textDecorationLine: 'line-through',
    color: colors.textSecondary,
    fontSize: 12,
  },
  storeProductSalePrice: {
    ...typography.bodyBold,
    color: colors.error,
    fontSize: 14,
  },
  storeProductUnitPrice: {
    ...typography.caption,
    color: colors.primary,
    fontSize: 11,
    fontWeight: '600',
  },
  storeProductUnitPriceBest: {
    ...typography.bodyBold,
    color: colors.accent,
    fontSize: 13,
  },
  extractQuantityButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    gap: 4,
  },
  extractQuantityButtonText: {
    ...typography.caption,
    color: colors.surface,
    fontWeight: '700',
    fontSize: 10,
  },
});
