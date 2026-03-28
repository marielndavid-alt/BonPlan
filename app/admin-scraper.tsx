
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import { getSupabaseClient, useAlert } from '@/template';
import { FunctionsHttpError } from '@supabase/supabase-js';

interface ScrapedProduct {
  name: string;
  price?: number;
  salePrice?: number;
  quantity?: string;
  imageUrl?: string;
  brand?: string;
  url: string;
  parsedQuantity?: number;
  unitType?: string;
  unitPrice?: number;
}

export default function AdminScraperScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();
  const [url, setUrl] = useState('');
  const [storeCode, setStoreCode] = useState('');
  const [maxProducts, setMaxProducts] = useState('20');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ScrapedProduct[]>([]);
  const [scrapingType, setScrapingType] = useState<'single' | 'collection' | ''>('');
  const [totalDetected, setTotalDetected] = useState(0);
  const [isTruncated, setIsTruncated] = useState(false);


  const handleScrape = async (saveToDB: boolean = false) => {
    if (!url.trim()) {
      showAlert('Erreur', 'Veuillez entrer une URL');
      return;
    }

    // Validation basique de l'URL
    try {
      new URL(url);
    } catch {
      showAlert('Erreur', 'URL invalide');
      return;
    }

    setLoading(true);
    setResults([]);
    setScrapingType('');

    try {
      const supabase = getSupabaseClient();
      const maxProductsNum = parseInt(maxProducts) || 50;
      
      // ⚠️ IMPORTANT: Le timeout réseau par défaut de React Native est de 30s.
      // Pour un scraping de 20 produits (20 × 2.5s + délais = ~60s),
      // on doit utiliser un timeout personnalisé de 90 secondes.
      // CEPENDANT, Supabase ne permet PAS de configurer le timeout de `functions.invoke()`.
      // Solution : utiliser fetch() direct avec AbortSignal customisé
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 90000); // 90 secondes
      
      const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
      
      const response = await fetch(`${SUPABASE_URL}/functions/v1/scrape-custom-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          url, 
          storeCode: storeCode.trim() || undefined, 
          saveToDB,
          maxProducts: maxProductsNum
        }),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text();
        let parsedError;
        try {
          parsedError = JSON.parse(errorText);
        } catch {
          parsedError = { message: errorText };
        }
        throw new Error(parsedError.error || parsedError.message || `HTTP ${response.status}`);
      }
      
      const data = await response.json();
      const error = null;

      // L'erreur est maintenant lancée comme exception, pas un objet error
      // (le code error ci-dessous ne sera jamais atteint)

      if (data && data.success) {
        setResults(data.products || []);
        setScrapingType(data.type || '');
        setTotalDetected(data.totalDetected || data.count);
        setIsTruncated(data.truncated || false);
        
        if (saveToDB) {
          let message = `${data.count} produit${data.count > 1 ? 's' : ''} ${data.count > 1 ? 'sauvegardés' : 'sauvegardé'} en base de données`;
          
          // Afficher les statistiques de la base de données
          if (data.database) {
            message += `\n\n📊 Résumé DB:`;
            message += `\n• Produits créés: ${data.database.productsCreated}`;
            message += `\n• Prix ajoutés: ${data.database.pricesCreated}`;
            if (data.database.linksCreated > 0) {
              message += `\n• Liens automatiques créés: ${data.database.linksCreated} 🔗`;
            }
          }
          
          if (data.truncated) {
            message += `\n\n⚠️ ${data.totalDetected} produits détectés sur cette page, ${data.count} scrapés (limite: ${maxProducts})`;
          }
          if (data.singlePageMode && data.totalDetected > data.count) {
            message += `\n\n💡 Pour scraper plus de produits, modifiez l'URL pour accéder aux pages suivantes (ex: ?page=2)`;
          }
          showAlert('Succès', message, [
            { 
              text: 'OK', 
              onPress: () => {
                router.back();
              }
            }
          ]);
        } else {
          let message = `${data.count} produit${data.count > 1 ? 's trouvés' : ' trouvé'}`;
          if (data.truncated) {
            message += `\n\n⚠️ ${data.totalDetected} produits détectés sur cette page, affichage limité à ${data.count}`;
          }
          if (data.hint) {
            message += `\n\n💡 ${data.hint}`;
          }
          showAlert('Scraping réussi', message);
        }
      } else if (data && data.error) {
        // Gérer les erreurs métier retournées par l'Edge Function
        showAlert('Erreur de scraping', data.error + (data.hint ? '\n\n💡 ' + data.hint : ''));
      } else {
        showAlert('Erreur', 'Aucun produit trouvé');
      }
    } catch (error: any) {
      console.error('[AdminScraper] Error:', error);
      
      let errorMessage = error.message || 'Une erreur est survenue';
      let errorTitle = 'Erreur de scraping';
      
      // Gérer les cas spécifiques d'erreur
      if (error.name === 'AbortError') {
        errorTitle = 'Timeout (délai dépassé)';
        errorMessage = `Le scraping a dépassé 90 secondes.\n\n💡 Solutions:\n\n1. Réduisez la limite à 5-10 produits\n   (actuellement: ${maxProducts})\n\n2. Scrapez une page de catégorie\n   (au lieu d'une recherche)\n\n3. Scrapez page par page avec\n   ?page=1, ?page=2, etc.`;
      } else if (errorMessage.includes('Network request failed')) {
        errorTitle = 'Impossible de contacter la fonction';
        errorMessage = 'Vérifiez que:\n\n1. L\'Edge Function "scrape-custom-url" est déployée\n2. Votre connexion internet est active\n3. Les variables d\'environnement sont configurées';
      } else if (errorMessage.includes('HTTP 504')) {
        errorTitle = 'Timeout serveur';
        errorMessage = `L'Edge Function a dépassé 60 secondes côté serveur.\n\nRéduisez la limite à 10 produits maximum.`;
      }
      
      showAlert(errorTitle, errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price?: number): string => {
    if (!price) return 'N/A';
    return `${price.toFixed(2)}$`;
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Scraper personnalisé</Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>URL à scraper</Text>
          <Text style={styles.sectionSubtitle}>
            Entrez l'URL d'un produit unique ou d'une page de collection
          </Text>
          
          <View style={styles.warningBox}>
            <MaterialIcons name="warning" size={16} color={colors.warning} />
            <Text style={styles.warningText}>
              ⏱️ Timeout limité à 60 secondes (limite Supabase).{"\n"}
              • Max 25 produits par page (Maxi){"\n"}
              • Max 15 produits par page (Metro){"\n"}
              • Pour scraper plus: relancez avec l'URL de la page suivante
            </Text>
          </View>
          
          <TextInput
            style={styles.input}
            placeholder="https://example.com/products/huile-olive"
            value={url}
            onChangeText={setUrl}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            placeholderTextColor={colors.textSecondary}
          />

          <Text style={styles.sectionTitle}>Code magasin (optionnel)</Text>
          <Text style={styles.sectionSubtitle}>
            metro, iga, maxi, superc (sans espace), walmart, loblaws, avril, rachelle
          </Text>
          
          <TextInput
            style={styles.input}
            placeholder="metro"
            value={storeCode}
            onChangeText={setStoreCode}
            autoCapitalize="none"
            autoCorrect={false}
            placeholderTextColor={colors.textSecondary}
          />

          <Text style={styles.sectionTitle}>Limite de produits (collections)</Text>
          <Text style={styles.sectionSubtitle}>
            Nombre maximum de produits à scraper par page{"\n"}
            • Maxi: max 25 produits{"\n"}
            • Metro: max 15 produits (site lent){"\n"}
            • Autres: max 20 produits
          </Text>
          
          <TextInput
            style={styles.input}
            placeholder="20"
            value={maxProducts}
            onChangeText={setMaxProducts}
            keyboardType="number-pad"
            placeholderTextColor={colors.textSecondary}
          />

          <View style={styles.buttonRow}>
            <Pressable
              style={[styles.button, styles.buttonPreview]}
              onPress={() => handleScrape(false)}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color={colors.surface} />
              ) : (
                <>
                  <MaterialIcons name="visibility" size={20} color={colors.surface} />
                  <Text style={styles.buttonText}>Prévisualiser</Text>
                </>
              )}
            </Pressable>

            <Pressable
              style={[styles.button, styles.buttonSave]}
              onPress={() => handleScrape(true)}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color={colors.surface} />
              ) : (
                <>
                  <MaterialIcons name="save" size={20} color={colors.surface} />
                  <Text style={styles.buttonText}>Sauvegarder en DB</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>

        {scrapingType && (
          <View style={styles.typeIndicator}>
            <MaterialIcons 
              name={scrapingType === 'collection' ? 'grid-view' : 'shopping-bag'} 
              size={20} 
              color={colors.primary} 
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.typeText}>
                {scrapingType === 'collection' ? 'Collection de produits' : 'Produit unique'}
              </Text>
              {isTruncated && (
                <Text style={styles.warningText}>
                  ⚠️ {totalDetected} détectés, {results.length} affichés
                </Text>
              )}
            </View>
          </View>
        )}

        {results.length > 0 && (
          <View style={styles.resultsSection}>
            <Text style={styles.resultsTitle}>
              Résultats ({results.length} produit{results.length > 1 ? 's' : ''})
            </Text>

            {results.map((product, index) => (
              <View key={index} style={styles.productCard}>
                {product.imageUrl && (
                  <Image
                    source={{ uri: product.imageUrl }}
                    style={styles.productImage}
                    resizeMode="contain"
                  />
                )}
                
                <View style={styles.productInfo}>
                  <Text style={styles.productName} numberOfLines={2}>
                    {product.name}
                  </Text>

                  {product.brand && (
                    <Text style={styles.productBrand}>{product.brand}</Text>
                  )}

                  {product.quantity && (
                    <View style={styles.quantityBadge}>
                      <MaterialIcons name="inventory-2" size={14} color={colors.primary} />
                      <Text style={styles.quantityText}>{product.quantity}</Text>
                    </View>
                  )}

                  <View style={styles.priceRow}>
                    {product.price && (
                      <View style={styles.priceBlock}>
                        <Text style={styles.priceLabel}>Prix</Text>
                        <Text
                          style={[
                            styles.priceValue,
                            product.salePrice && styles.priceStrikethrough,
                          ]}
                        >
                          {formatPrice(product.price)}
                        </Text>
                      </View>
                    )}

                    {product.salePrice && (
                      <View style={styles.priceBlock}>
                        <Text style={styles.priceLabel}>En rabais</Text>
                        <Text style={[styles.priceValue, styles.salePriceValue]}>
                          {formatPrice(product.salePrice)}
                        </Text>
                      </View>
                    )}

                    {product.unitPrice && product.unitType && (
                      <View style={styles.priceBlock}>
                        <Text style={styles.priceLabel}>Prix unitaire</Text>
                        <Text style={styles.priceValueUnit}>
                          {product.unitPrice.toFixed(4)}$/{product.unitType}
                        </Text>
                      </View>
                    )}
                  </View>

                  <Pressable
                    style={styles.urlButton}
                    onPress={() => console.log('Open URL:', product.url)}
                  >
                    <MaterialIcons name="open-in-new" size={16} color={colors.primary} />
                    <Text style={styles.urlButtonText} numberOfLines={1}>
                      {product.url}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}

        {!loading && results.length === 0 && url.length > 0 && (
          <View style={styles.emptyState}>
            <MaterialIcons name="search-off" size={48} color={colors.textSecondary} />
            <Text style={styles.emptyText}>
              Aucun résultat pour l'instant
            </Text>
            <Text style={styles.emptySubtext}>
              Lancez le scraping pour voir les produits détectés
            </Text>
          </View>
        )}
      </ScrollView>
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
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.md,
  },
  backButton: {
    padding: spacing.xs,
  },
  title: {
    ...typography.h2,
    color: colors.text,
    flex: 1,
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  sectionSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    ...typography.body,
    color: colors.text,
    marginBottom: spacing.lg,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
    minHeight: 48,
  },
  buttonPreview: {
    backgroundColor: colors.primary,
  },
  buttonSave: {
    backgroundColor: colors.success,
  },
  buttonText: {
    ...typography.bodyBold,
    color: colors.surface,
  },
  typeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary + '15',
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  typeText: {
    ...typography.bodyBold,
    color: colors.primary,
  },
  warningText: {
    ...typography.small,
    color: colors.warning,
    marginTop: 4,
  },
  resultsSection: {
    padding: spacing.md,
  },
  resultsTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.md,
  },
  productCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  productImage: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.background,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    ...typography.bodyBold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  productBrand: {
    ...typography.caption,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginBottom: spacing.sm,
  },
  quantityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    alignSelf: 'flex-start',
    marginBottom: spacing.sm,
    gap: 4,
  },
  quantityText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },
  priceRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  priceBlock: {
    minWidth: 80,
  },
  priceLabel: {
    ...typography.small,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  priceValue: {
    ...typography.h3,
    color: colors.text,
  },
  priceStrikethrough: {
    textDecorationLine: 'line-through',
    color: colors.textSecondary,
    fontSize: 14,
  },
  salePriceValue: {
    color: colors.success,
  },
  priceValueUnit: {
    ...typography.bodyBold,
    color: colors.primary,
    fontSize: 15,
  },
  urlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  urlButtonText: {
    ...typography.small,
    color: colors.primary,
    flex: 1,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
    marginTop: spacing.xxl,
  },
  emptyText: {
    ...typography.h3,
    color: colors.textSecondary,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  emptySubtext: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.warning + '15',
    borderLeftWidth: 3,
    borderLeftColor: colors.warning,
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  warningText: {
    ...typography.small,
    color: colors.text,
    flex: 1,
    lineHeight: 18,
  },
});
