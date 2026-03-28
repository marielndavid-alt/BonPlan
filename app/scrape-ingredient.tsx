import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import { scrapeProduct } from '@/services/universalScrapingService';
import { scrapeIngredientAsync, ScrapingMethod } from '@/services/ingredientScrapingService';

export default function ScrapeIngredientScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [productName, setProductName] = useState('');
  const [scrapingMethod, setScrapingMethod] = useState<ScrapingMethod>('google-shopping');
  const [scraping, setScraping] = useState(false);
  const [progressMessage, setProgressMessage] = useState('');
  const [result, setResult] = useState<{ success: boolean; pricesAdded: number; error?: string } | null>(null);

  const handleScrape = async () => {
    if (!productName.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer un nom de produit');
      return;
    }

    setScraping(true);
    setResult(null);
    setProgressMessage('Préparation...');

    try {
      console.log(`🚀 Lancement du scraping pour: "${productName}" (méthode: ${scrapingMethod})`);
      
      const scrapeResult = await scrapeIngredientAsync(
        productName,
        undefined,
        (progress) => {
          const message = scrapingMethod === 'google-shopping'
            ? `Google Shopping: ${progress.totalProducts} produit(s) trouvé(s)`
            : `Scraping ${progress.currentStore || ''} (${progress.completedStores}/${progress.totalStores})`;
          setProgressMessage(message);
        },
        scrapingMethod
      );
      
      setResult(scrapeResult);
      
      if (scrapeResult.success) {
        Alert.alert(
          'Scraping terminé',
          `${scrapeResult.pricesAdded} prix ajoutés pour "${productName}"`
        );
      } else {
        Alert.alert(
          'Erreur',
          scrapeResult.error || 'Aucun prix trouvé pour ce produit'
        );
      }
    } catch (error: any) {
      console.error('Erreur scraping:', error);
      setResult({ success: false, pricesAdded: 0, error: error.message });
      Alert.alert('Erreur', error.message || 'Le scraping a échoué');
    } finally {
      setScraping(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Scraper un ingrédient</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.infoBox}>
          <MaterialIcons name="info" size={20} color={colors.primary} />
          <Text style={styles.infoText}>
            {scrapingMethod === 'google-shopping'
              ? 'Mode Google Shopping: recherche agrégée dans tous les magasins québécois (Metro, IGA, Maxi, Super C, Walmart, Avril, Rachelle Béry) via une seule API. Plus rapide et plus fiable.'
              : 'Mode traditionnel: scraping direct sur chaque site de magasin. Peut rencontrer des timeouts sur Metro/IGA/Walmart.'}
          </Text>
        </View>

        <View style={styles.formSection}>
          <Text style={styles.label}>Méthode de scraping</Text>
          <View style={styles.methodSelector}>
            <Pressable
              style={[
                styles.methodButton,
                scrapingMethod === 'google-shopping' && styles.methodButtonActive,
              ]}
              onPress={() => setScrapingMethod('google-shopping')}
              disabled={scraping}
            >
              <MaterialIcons
                name="shopping-cart"
                size={20}
                color={scrapingMethod === 'google-shopping' ? colors.surface : colors.text}
              />
              <Text
                style={[
                  styles.methodButtonText,
                  scrapingMethod === 'google-shopping' && styles.methodButtonTextActive,
                ]}
              >
                Google Shopping
              </Text>
              <View style={styles.recommendedBadge}>
                <Text style={styles.recommendedText}>Recommandé</Text>
              </View>
            </Pressable>
            <Pressable
              style={[
                styles.methodButton,
                scrapingMethod === 'traditional' && styles.methodButtonActive,
              ]}
              onPress={() => setScrapingMethod('traditional')}
              disabled={scraping}
            >
              <MaterialIcons
                name="code"
                size={20}
                color={scrapingMethod === 'traditional' ? colors.surface : colors.text}
              />
              <Text
                style={[
                  styles.methodButtonText,
                  scrapingMethod === 'traditional' && styles.methodButtonTextActive,
                ]}
              >
                Traditionnel
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.formSection}>
          <Text style={styles.label}>Nom de l'ingrédient</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: lentilles, oignon, tomate..."
            value={productName}
            onChangeText={setProductName}
            autoCapitalize="none"
            editable={!scraping}
          />
        </View>

        <Pressable
          style={[styles.scrapeButton, scraping && styles.scrapeButtonDisabled]}
          onPress={handleScrape}
          disabled={scraping}
        >
          {scraping ? (
            <ActivityIndicator color={colors.surface} />
          ) : (
            <>
              <MaterialIcons name="sync" size={24} color={colors.surface} />
              <Text style={styles.scrapeButtonText}>Lancer le scraping</Text>
            </>
          )}
        </Pressable>

        {scraping && (
          <View style={styles.progressBox}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.progressText}>
              {progressMessage || 'Scraping en cours...'}
            </Text>
            <Text style={styles.progressSubtext}>
              {scrapingMethod === 'google-shopping'
                ? 'Recherche via Google Shopping... (~10 secondes)'
                : 'Cela peut prendre quelques minutes (environ 2-3 minutes pour 7 magasins)'}
            </Text>
          </View>
        )}

        {result && !scraping && (
          <View style={[
            styles.resultBox,
            result.success ? styles.resultBoxSuccess : styles.resultBoxError
          ]}>
            <MaterialIcons 
              name={result.success ? "check-circle" : "error"} 
              size={32} 
              color={result.success ? colors.success : colors.error} 
            />
            <View style={styles.resultContent}>
              <Text style={styles.resultTitle}>
                {result.success ? 'Scraping réussi !' : 'Échec du scraping'}
              </Text>
              <Text style={styles.resultText}>
                {result.success 
                  ? `${result.pricesAdded} prix ajouté(s) pour "${productName}"`
                  : result.error || 'Aucun prix trouvé'
                }
              </Text>
            </View>
          </View>
        )}

        <View style={styles.examplesSection}>
          <Text style={styles.examplesTitle}>Exemples d'ingrédients populaires:</Text>
          <View style={styles.examplesGrid}>
            {['lentilles', 'oignon', 'tomate', 'fromage', 'huile', 'riz'].map((example) => (
              <Pressable
                key={example}
                style={styles.exampleChip}
                onPress={() => setProductName(example)}
                disabled={scraping}
              >
                <Text style={styles.exampleText}>{example}</Text>
              </Pressable>
            ))}
          </View>
        </View>
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
  },
  content: {
    flex: 1,
    padding: spacing.lg,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  infoText: {
    ...typography.body,
    color: colors.text,
    flex: 1,
    lineHeight: 22,
  },
  formSection: {
    marginBottom: spacing.lg,
  },
  label: {
    ...typography.bodyBold,
    color: colors.text,
    marginBottom: spacing.sm,
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
  scrapeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  scrapeButtonDisabled: {
    opacity: 0.6,
  },
  scrapeButtonText: {
    ...typography.bodyBold,
    color: colors.surface,
  },
  progressBox: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  progressText: {
    ...typography.bodyBold,
    color: colors.text,
    textAlign: 'center',
  },
  progressSubtext: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  resultBox: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.md,
    borderWidth: 2,
  },
  resultBoxSuccess: {
    borderColor: colors.success,
  },
  resultBoxError: {
    borderColor: colors.error,
  },
  resultContent: {
    flex: 1,
  },
  resultTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  resultText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  examplesSection: {
    marginTop: spacing.xl,
  },
  examplesTitle: {
    ...typography.bodyBold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  examplesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  exampleChip: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  exampleText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },
  methodSelector: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  methodButton: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    gap: spacing.xs,
    position: 'relative',
  },
  methodButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  methodButtonText: {
    ...typography.caption,
    color: colors.text,
    fontWeight: '600',
  },
  methodButtonTextActive: {
    color: colors.surface,
  },
  recommendedBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: colors.success,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
  },
  recommendedText: {
    fontSize: 10,
    color: colors.surface,
    fontWeight: '700',
  },
});
