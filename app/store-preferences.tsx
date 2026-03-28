import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows, storeInfo } from '@/constants/theme';
import { useAuth, useAlert } from '@/template';
import { getSupabaseClient } from '@/template';

const stores = [
  { id: 'metro', name: 'Métro', icon: 'store' as const },
  { id: 'iga', name: 'IGA', icon: 'store' as const },
  { id: 'superc', name: 'Super C', icon: 'store' as const },
  { id: 'maxi', name: 'Maxi', icon: 'store' as const },
  { id: 'loblaws', name: 'Loblaws', icon: 'store' as const },
  { id: 'walmart', name: 'Walmart', icon: 'store' as const },
];

export default function StorePreferencesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const supabase = getSupabaseClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedStores, setSelectedStores] = useState<string[]>([]);

  useEffect(() => {
    loadPreferences();
  }, [user]);

  const loadPreferences = async () => {
    if (!user) return;

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('user_preferences')
        .select('selected_stores')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading store preferences:', error);
        return;
      }

      if (data?.selected_stores) {
        setSelectedStores(data.selected_stores as string[]);
      } else {
        // Default: all stores selected
        setSelectedStores(stores.map(s => s.id));
      }
    } catch (error) {
      console.error('Error in loadPreferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleStore = (storeId: string) => {
    setSelectedStores(prev => {
      if (prev.includes(storeId)) {
        // Don't allow deselecting all stores
        if (prev.length === 1) {
          showAlert('Attention', 'Vous devez sélectionner au moins une épicerie');
          return prev;
        }
        return prev.filter(id => id !== storeId);
      } else {
        return [...prev, storeId];
      }
    });
  };

  const handleSave = async () => {
    if (!user) return;

    if (selectedStores.length === 0) {
      showAlert('Erreur', 'Veuillez sélectionner au moins une épicerie');
      return;
    }

    try {
      setSaving(true);

      // Charger les préférences existantes pour ne pas écraser postal_code
      const { data: existingPrefs } = await supabase
        .from('user_preferences')
        .select('postal_code')
        .eq('user_id', user.id)
        .single();

      const { error } = await supabase
        .from('user_preferences')
        .upsert({
          user_id: user.id,
          postal_code: existingPrefs?.postal_code || null,
          selected_stores: selectedStores,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

      if (error) throw error;

      showAlert('Succès', 'Vos préférences ont été sauvegardées');
      router.back();
    } catch (error: any) {
      console.error('Error saving store preferences:', error);
      showAlert('Erreur', error.message || 'Impossible de sauvegarder vos préférences');
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>Non connecté</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.7 }]}
          hitSlop={12}
        >
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <View style={styles.headerTextContainer}>
          <Text style={styles.title}>Mes épiceries</Text>
          <Text style={styles.subtitle}>
            Sélectionnez les magasins à comparer
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <>
            <View style={styles.infoCard}>
              <MaterialIcons name="info-outline" size={24} color={colors.primary} />
              <Text style={styles.infoText}>
                Les épiceries non sélectionnées ne seront pas affichées dans la comparaison de prix
              </Text>
            </View>

            <View style={styles.storeList}>
              {stores.map(store => {
                const isSelected = selectedStores.includes(store.id);
                const storeColor = storeInfo[store.id as keyof typeof storeInfo]?.color || colors.primary;

                return (
                  <Pressable
                    key={store.id}
                    onPress={() => toggleStore(store.id)}
                    style={({ pressed }) => [
                      styles.storeItem,
                      isSelected && styles.storeItemSelected,
                      pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] },
                    ]}
                  >
                    <View style={styles.storeLeft}>
                      <View
                        style={[
                          styles.storeIconContainer,
                          { backgroundColor: isSelected ? storeColor : colors.surfaceLight },
                        ]}
                      >
                        <MaterialIcons
                          name={store.icon}
                          size={24}
                          color={isSelected ? colors.surface : colors.textSecondary}
                        />
                      </View>
                      <Text style={[styles.storeName, !isSelected && styles.storeNameInactive]}>
                        {store.name}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.checkbox,
                        isSelected && [styles.checkboxSelected, { backgroundColor: storeColor }],
                      ]}
                    >
                      {isSelected && (
                        <MaterialIcons name="check" size={20} color={colors.surface} />
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.summary}>
              <Text style={styles.summaryText}>
                {selectedStores.length} épicerie{selectedStores.length > 1 ? 's' : ''} sélectionnée{selectedStores.length > 1 ? 's' : ''}
              </Text>
            </View>
          </>
        )}

        <View style={{ height: spacing.xxl }} />
      </ScrollView>

      {/* Fixed Bottom Button */}
      {!loading && (
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.md }]}>
          <Pressable
            onPress={handleSave}
            disabled={saving}
            style={({ pressed }) => [
              styles.saveButton,
              pressed && { opacity: 0.9 },
              saving && { opacity: 0.6 },
            ]}
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.surface} />
            ) : (
              <>
                <MaterialIcons name="check" size={24} color={colors.surface} />
                <Text style={styles.saveButtonText}>Sauvegarder mes préférences</Text>
              </>
            )}
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.background,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerTextContainer: {
    flex: 1,
  },
  title: {
    ...typography.h2,
    color: colors.text,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  loadingContainer: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
  },
  infoCard: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.surfaceLight,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoText: {
    flex: 1,
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  storeList: {
    gap: spacing.sm,
  },
  storeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  storeItemSelected: {
    borderWidth: 2,
  },
  storeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  storeIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  storeName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  storeNameInactive: {
    color: colors.textSecondary,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.sm,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    borderWidth: 0,
  },
  summary: {
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  summaryText: {
    ...typography.bodyBold,
    color: colors.primary,
  },
  bottomBar: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    ...shadows.lg,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.surface,
  },
  errorText: {
    ...typography.h3,
    color: colors.textSecondary,
  },
});
