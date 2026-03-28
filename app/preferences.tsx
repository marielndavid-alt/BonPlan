import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography } from '@/constants/theme';
import { onboardingService, OnboardingData } from '@/services/onboardingService';
import { useAlert } from '@/template';

type DietOption = 'dairy-free' | 'gluten-free' | 'pork-free' | 'vegan' | 'vegetarian' | 'pescatarian';
type EquipmentOption = 'oven' | 'microwave' | 'stovetop' | 'blender' | 'multicooker' | 'airfryer';

const COMMON_INGREDIENTS = [
  { emoji: '🦐', label: 'Fruits de mer' },
  { emoji: '🥚', label: 'Œuf' },
  { emoji: '🌱', label: 'Soja' },
  { emoji: '🍄', label: 'Champignons' },
  { emoji: '🌿', label: 'Coriandre' },
  { emoji: '🫒', label: 'Olive' },
  { emoji: '🐟', label: 'Poisson' },
  { emoji: '🍅', label: 'Tomate' },
  { emoji: '🥜', label: 'Fruits à coque' },
];

export default function PreferencesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // État des données
  const [postalCode, setPostalCode] = useState('');
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState<{ age: number }[]>([]);
  const [cats, setCats] = useState(0);
  const [dogs, setDogs] = useState(0);
  const [selectedEquipment, setSelectedEquipment] = useState<EquipmentOption[]>([]);
  const [selectedDiet, setSelectedDiet] = useState<DietOption[]>([]);
  const [excludedIngredients, setExcludedIngredients] = useState<string[]>([]);
  const [ingredientSearch, setIngredientSearch] = useState('');
  const [ingredientSearchModalVisible, setIngredientSearchModalVisible] = useState(false);
  
  // Modal pour l'âge de l'enfant
  const [childAgeModalVisible, setChildAgeModalVisible] = useState(false);
  const [selectedChildIndex, setSelectedChildIndex] = useState<number | null>(null);
  const [tempChildAge, setTempChildAge] = useState('');

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    setLoading(true);
    const prefs = await onboardingService.getPreferences();
    
    if (prefs) {
      setPostalCode(prefs.postalCode || '');
      setAdults(prefs.household.adults || 2);
      setChildren(prefs.household.children || []);
      setCats(prefs.household.pets?.filter(p => p.type === 'cat').length || 0);
      setDogs(prefs.household.pets?.filter(p => p.type === 'dog').length || 0);
      setSelectedEquipment(prefs.equipment as EquipmentOption[] || []);
      setSelectedDiet(prefs.diet as DietOption[] || []);
      setExcludedIngredients(prefs.excludedIngredients || []);
    }
    
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    
    const data: OnboardingData = {
      postalCode,
      household: {
        adults,
        children,
        pets: [
          ...Array(cats).fill({ type: 'cat' as const }),
          ...Array(dogs).fill({ type: 'dog' as const }),
        ],
      },
      stores: [], // Géré séparément dans store-preferences
      equipment: selectedEquipment,
      diet: selectedDiet,
      excludedIngredients,
      notifications: false, // Géré séparément
    };

    await onboardingService.savePreferences(data);
    setSaving(false);
    showAlert('Succès', 'Vos préférences ont été mises à jour');
    router.back();
  };

  const validatePostalCode = (code: string): boolean => {
    const canadianPostalRegex = /^[A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d$/;
    return canadianPostalRegex.test(code);
  };

  const formatPostalCode = (text: string): string => {
    const cleaned = text.replace(/\s/g, '').toUpperCase();
    const limited = cleaned.slice(0, 6);
    if (limited.length > 3) {
      return `${limited.slice(0, 3)} ${limited.slice(3)}`;
    }
    return limited;
  };

  const handlePostalCodeChange = (text: string) => {
    const formatted = formatPostalCode(text);
    setPostalCode(formatted);
  };

  const handleAddChild = (index: number) => {
    setSelectedChildIndex(index);
    if (children[index]) {
      setTempChildAge(children[index].age.toString());
    } else {
      setTempChildAge('');
    }
    setChildAgeModalVisible(true);
  };

  const handleSaveChildAge = () => {
    if (!tempChildAge || selectedChildIndex === null) return;
    
    const age = parseInt(tempChildAge);
    if (isNaN(age) || age < 0 || age > 18) {
      return;
    }

    const newChildren = [...children];
    newChildren[selectedChildIndex] = { age };
    setChildren(newChildren);
    
    setChildAgeModalVisible(false);
    setTempChildAge('');
    setSelectedChildIndex(null);
  };

  const handleRemoveChild = (index: number) => {
    const newChildren = children.filter((_, i) => i !== index);
    setChildren(newChildren);
  };

  const toggleEquipment = (equipment: EquipmentOption) => {
    setSelectedEquipment(prev =>
      prev.includes(equipment) ? prev.filter(e => e !== equipment) : [...prev, equipment]
    );
  };

  const toggleDiet = (diet: DietOption) => {
    setSelectedDiet(prev =>
      prev.includes(diet) ? prev.filter(d => d !== diet) : [...prev, diet]
    );
  };

  const toggleIngredient = (ingredient: string) => {
    setExcludedIngredients(prev =>
      prev.includes(ingredient) ? prev.filter(i => i !== ingredient) : [...prev, ingredient]
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Modal pour l'âge de l'enfant */}
      <Modal
        visible={childAgeModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setChildAgeModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Âge de l'enfant</Text>
            <Text style={styles.modalSubtitle}>Quel âge a cet enfant?</Text>
            
            <TextInput
              style={styles.modalInput}
              placeholder="Âge (0-18)"
              placeholderTextColor={colors.textSecondary}
              value={tempChildAge}
              onChangeText={setTempChildAge}
              keyboardType="number-pad"
              maxLength={2}
              autoFocus
            />

            <View style={styles.modalButtons}>
              <Pressable
                onPress={() => {
                  setChildAgeModalVisible(false);
                  setTempChildAge('');
                  setSelectedChildIndex(null);
                }}
                style={[styles.modalButton, styles.modalButtonCancel]}
              >
                <Text style={styles.modalButtonTextCancel}>Annuler</Text>
              </Pressable>
              
              <Pressable
                onPress={handleSaveChildAge}
                style={[styles.modalButton, styles.modalButtonConfirm]}
                disabled={!tempChildAge}
              >
                <Text style={styles.modalButtonText}>Confirmer</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal pour la recherche d'ingrédients */}
      <Modal
        visible={ingredientSearchModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIngredientSearchModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Rechercher un ingrédient</Text>
            <Text style={styles.modalSubtitle}>Cherchez et ajoutez des ingrédients à exclure</Text>
            
            <TextInput
              style={styles.modalInput}
              placeholder="Ex: Arachides, lactose..."
              placeholderTextColor={colors.textSecondary}
              value={ingredientSearch}
              onChangeText={setIngredientSearch}
              autoFocus
            />

            <View style={styles.modalButtons}>
              <Pressable
                onPress={() => {
                  setIngredientSearchModalVisible(false);
                  setIngredientSearch('');
                }}
                style={[styles.modalButton, styles.modalButtonCancel]}
              >
                <Text style={styles.modalButtonTextCancel}>Annuler</Text>
              </Pressable>
              
              <Pressable
                onPress={() => {
                  if (ingredientSearch.trim()) {
                    toggleIngredient(ingredientSearch.trim());
                    setIngredientSearch('');
                    setIngredientSearchModalVisible(false);
                  }
                }}
                style={[styles.modalButton, styles.modalButtonConfirm]}
                disabled={!ingredientSearch.trim()}
              >
                <Text style={styles.modalButtonText}>Ajouter</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={28} color={colors.text} />
        </Pressable>
        <View style={styles.headerTextContainer}>
          <Text style={styles.title}>Mes Préférences</Text>
          <Text style={styles.subtitle}>Gérez vos préférences alimentaires</Text>
        </View>
      </View>

      {/* Content */}
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
       

        {/* Foyer */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>👥 Composition du foyer</Text>
          
          {/* Adultes */}
          <View style={styles.subsection}>
            <Text style={styles.subsectionTitle}>Adultes</Text>
            <View style={styles.counterRow}>
              {[1, 2, 3, 4, 5].map(count => (
                <Pressable
                  key={`adult-${count}`}
                  onPress={() => setAdults(count)}
                  style={styles.counterIconSmall}
                >
                  <MaterialIcons 
                    name="person" 
                    size={36} 
                    color={adults >= count ? colors.error : colors.textLight} 
                  />
                </Pressable>
              ))}
            </View>
          </View>

          {/* Enfants */}
          <View style={styles.subsection}>
            <Text style={styles.subsectionTitle}>Enfants</Text>
            <View style={styles.counterRow}>
              {[0, 1, 2, 3, 4].map(index => {
                const child = children[index];
                const isActive = child !== undefined;
                
                return (
                  <Pressable
                    key={`child-${index}`}
                    onPress={() => handleAddChild(index)}
                    onLongPress={() => isActive && handleRemoveChild(index)}
                    style={styles.counterIconSmall}
                  >
                    <MaterialIcons 
                      name="child-care" 
                      size={32} 
                      color={isActive ? colors.error : colors.textLight} 
                    />
                    {isActive && (
                      <Text style={styles.ageLabel}>{child.age} ans</Text>
                    )}
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.helperText}>Appuyez pour saisir l'âge, appuyez longuement pour retirer</Text>
          </View>

          {/* Animaux */}
          <View style={styles.subsection}>
            <Text style={styles.subsectionTitle}>Animaux</Text>
            <View style={styles.counterRow}>
              <Pressable
                onPress={() => setCats(cats > 0 ? 0 : 1)}
                style={styles.animalIcon}
              >
                <Text style={[styles.animalEmoji, cats > 0 && styles.animalEmojiActive]}>🐱</Text>
                <Text style={styles.animalLabel}>Chat</Text>
              </Pressable>
              <Pressable
                onPress={() => setDogs(dogs > 0 ? 0 : 1)}
                style={styles.animalIcon}
              >
                <Text style={[styles.animalEmoji, dogs > 0 && styles.animalEmojiActive]}>🐕</Text>
                <Text style={styles.animalLabel}>Chien</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* Équipements de cuisine */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🍳 Équipements de cuisine</Text>
          <View style={styles.equipmentGrid}>
            <Pressable onPress={() => toggleEquipment('oven')} style={styles.equipmentItem}>
              <View style={[styles.equipmentIcon, selectedEquipment.includes('oven') && styles.equipmentIconActive]}>
                <Text style={styles.equipmentEmoji}>🔥</Text>
              </View>
              <Text style={styles.equipmentLabel}>Four</Text>
            </Pressable>

            <Pressable onPress={() => toggleEquipment('microwave')} style={styles.equipmentItem}>
              <View style={[styles.equipmentIcon, selectedEquipment.includes('microwave') && styles.equipmentIconActive]}>
                <Text style={styles.equipmentEmoji}>📻</Text>
              </View>
              <Text style={styles.equipmentLabel}>Micro-ondes</Text>
            </Pressable>

            <Pressable onPress={() => toggleEquipment('stovetop')} style={styles.equipmentItem}>
              <View style={[styles.equipmentIcon, selectedEquipment.includes('stovetop') && styles.equipmentIconActive]}>
                <Text style={styles.equipmentEmoji}>🍳</Text>
              </View>
              <Text style={styles.equipmentLabel}>Plaques</Text>
            </Pressable>

            <Pressable onPress={() => toggleEquipment('blender')} style={styles.equipmentItem}>
              <View style={[styles.equipmentIcon, selectedEquipment.includes('blender') && styles.equipmentIconActive]}>
                <Text style={styles.equipmentEmoji}>🥤</Text>
              </View>
              <Text style={styles.equipmentLabel}>Mixeur</Text>
            </Pressable>

            <Pressable onPress={() => toggleEquipment('multicooker')} style={styles.equipmentItem}>
              <View style={[styles.equipmentIcon, selectedEquipment.includes('multicooker') && styles.equipmentIconActive]}>
                <Text style={styles.equipmentEmoji}>🍲</Text>
              </View>
              <Text style={styles.equipmentLabel}>Multi cooker</Text>
            </Pressable>

            <Pressable onPress={() => toggleEquipment('airfryer')} style={styles.equipmentItem}>
              <View style={[styles.equipmentIcon, selectedEquipment.includes('airfryer') && styles.equipmentIconActive]}>
                <Text style={styles.equipmentEmoji}>💨</Text>
              </View>
              <Text style={styles.equipmentLabel}>Air-fryer</Text>
            </Pressable>
          </View>
        </View>

        {/* Régime alimentaire */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🥗 Régime alimentaire</Text>
          <View style={styles.dietGrid}>
            <Pressable onPress={() => toggleDiet('dairy-free')} style={styles.dietItem}>
              <View style={[styles.dietIcon, selectedDiet.includes('dairy-free') && styles.dietIconActive]}>
                <Text style={styles.dietEmoji}>🥛</Text>
                <View style={styles.strikethrough} />
              </View>
              <Text style={styles.dietLabel}>Sans produit laitier</Text>
            </Pressable>

            <Pressable onPress={() => toggleDiet('gluten-free')} style={styles.dietItem}>
              <View style={[styles.dietIcon, selectedDiet.includes('gluten-free') && styles.dietIconActive]}>
                <Text style={styles.dietEmoji}>🌾</Text>
                <View style={styles.strikethrough} />
              </View>
              <Text style={styles.dietLabel}>Sans gluten</Text>
            </Pressable>

            <Pressable onPress={() => toggleDiet('pork-free')} style={styles.dietItem}>
              <View style={[styles.dietIcon, selectedDiet.includes('pork-free') && styles.dietIconActive]}>
                <Text style={styles.dietEmoji}>🐷</Text>
                <View style={styles.strikethrough} />
              </View>
              <Text style={styles.dietLabel}>Sans porc</Text>
            </Pressable>

            <Pressable onPress={() => toggleDiet('vegan')} style={styles.dietItem}>
              <View style={[styles.dietIcon, selectedDiet.includes('vegan') && styles.dietIconActive]}>
                <Text style={styles.dietEmoji}>🌱</Text>
              </View>
              <Text style={styles.dietLabel}>Végétalien</Text>
            </Pressable>

            <Pressable onPress={() => toggleDiet('vegetarian')} style={styles.dietItem}>
              <View style={[styles.dietIcon, selectedDiet.includes('vegetarian') && styles.dietIconActive]}>
                <Text style={styles.dietEmoji}>🥕</Text>
              </View>
              <Text style={styles.dietLabel}>Végétarien</Text>
            </Pressable>

            <Pressable onPress={() => toggleDiet('pescatarian')} style={styles.dietItem}>
              <View style={[styles.dietIcon, selectedDiet.includes('pescatarian') && styles.dietIconActive]}>
                <Text style={styles.dietEmoji}>🐟</Text>
              </View>
              <Text style={styles.dietLabel}>Pesco-végétarien</Text>
            </Pressable>
          </View>
        </View>

        {/* Ingrédients à exclure */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🚫 Ingrédients à exclure</Text>
          <View style={styles.ingredientChips}>
            {COMMON_INGREDIENTS.map(ingredient => {
              const isSelected = excludedIngredients.includes(ingredient.label);
              return (
                <Pressable
                  key={ingredient.label}
                  onPress={() => toggleIngredient(ingredient.label)}
                  style={[styles.ingredientChip, isSelected && styles.ingredientChipActive]}
                >
                  <Text style={styles.ingredientEmoji}>{ingredient.emoji}</Text>
                  <Text style={[styles.ingredientLabel, isSelected && styles.ingredientLabelActive]}>{ingredient.label}</Text>
                  <MaterialIcons 
                    name={isSelected ? 'remove' : 'add'} 
                    size={20} 
                    color={isSelected ? colors.surface : colors.textSecondary} 
                  />
                </Pressable>
              );
            })}
            
            {/* Ingrédients personnalisés */}
            {excludedIngredients
              .filter(ing => !COMMON_INGREDIENTS.some(common => common.label === ing))
              .map(ingredient => (
                <Pressable
                  key={ingredient}
                  onPress={() => toggleIngredient(ingredient)}
                  style={[styles.ingredientChip, styles.ingredientChipActive]}
                >
                  <Text style={[styles.ingredientLabel, styles.ingredientLabelActive]}>{ingredient}</Text>
                  <MaterialIcons name="remove" size={20} color={colors.surface} />
                </Pressable>
              ))
            }
          </View>

          <Pressable 
            style={styles.searchButton}
            onPress={() => setIngredientSearchModalVisible(true)}
          >
            <MaterialIcons name="search" size={24} color={colors.surface} />
            <Text style={styles.searchButtonText}>Rechercher un ingrédient</Text>
          </Pressable>
        </View>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>

      {/* Footer button */}
      <View style={styles.footer}>
        <Pressable
          onPress={handleSave}
          style={({ pressed }) => [
            styles.saveButton,
            pressed && { opacity: 0.8 },
          ]}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color={colors.surface} />
          ) : (
            <Text style={styles.saveButtonText}>Enregistrer</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    backgroundColor: colors.background,
    gap: spacing.md,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerTextContainer: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.md,
  },
  subsection: {
    marginBottom: spacing.lg,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  counterRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  counterIconSmall: {
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ageLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.error,
    marginTop: 2,
  },
  helperText: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  animalIcon: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  animalEmoji: {
    fontSize: 48,
    opacity: 0.3,
  },
  animalEmojiActive: {
    opacity: 1,
  },
  animalLabel: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
  },
  equipmentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
  },
  equipmentItem: {
    width: '30%',
    alignItems: 'center',
    gap: spacing.sm,
  },
  equipmentIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
  },
  equipmentIconActive: {
    borderColor: colors.error,
    backgroundColor: colors.greenLight,
  },
  equipmentEmoji: {
    fontSize: 28,
  },
  equipmentLabel: {
    fontSize: 12,
    color: colors.text,
    textAlign: 'center',
  },
  dietGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
  },
  dietItem: {
    width: '30%',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dietIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
    position: 'relative',
  },
  dietIconActive: {
    borderColor: colors.textSecondary,
    backgroundColor: colors.purpleLight,
  },
  dietEmoji: {
    fontSize: 28,
  },
  strikethrough: {
    position: 'absolute',
    width: 50,
    height: 3,
    backgroundColor: colors.text,
    transform: [{ rotate: '-45deg' }],
  },
  dietLabel: {
    fontSize: 11,
    color: colors.text,
    textAlign: 'center',
  },
  ingredientChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  ingredientChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ingredientChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  ingredientEmoji: {
    fontSize: 18,
  },
  ingredientLabel: {
    fontSize: 13,
    color: colors.text,
  },
  ingredientLabelActive: {
    color: colors.surface,
  },
  searchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.accent,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  searchButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.surface,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.xs,
    ...Platform.select({
      ios: { fontFamily: 'Georgia' },
      android: { fontFamily: 'serif' },
      default: { fontFamily: 'Georgia' },
    }),
  },
  modalSubtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  modalInput: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    fontSize: 18,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  modalButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: colors.border,
  },
  modalButtonConfirm: {
    backgroundColor: colors.accent,
  },
  modalButtonTextCancel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.surface,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    backgroundColor: colors.background,
  },
  saveButton: {
    backgroundColor: colors.accent,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.surface,
  },
});
