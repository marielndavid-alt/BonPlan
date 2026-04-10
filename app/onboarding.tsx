import { supabase } from '@/lib/supabase';
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  SafeAreaView,
  Dimensions,
  ActivityIndicator,
  Platform,
  Modal,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFonts, InstrumentSerif_400Regular, InstrumentSerif_400Regular_Italic } from '@expo-google-fonts/instrument-serif';
import { OpenSans_400Regular, OpenSans_500Medium } from '@expo-google-fonts/open-sans';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, spacing, borderRadius } from '@/constants/theme';
import { onboardingService, OnboardingData } from '@/services/onboardingService';
import { revenueCatService } from '@/services/revenueCatService';
import { Linking } from 'react-native';
import { useAlert } from '@/template';
import * as Notifications from 'expo-notifications';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const STEPS = 9;

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

export default function OnboardingScreen() {
  const router = useRouter();
  const [fontsLoaded] = useFonts({
    InstrumentSerif_400Regular,
    InstrumentSerif_400Regular_Italic,
    OpenSans_400Regular,
    OpenSans_500Medium,
  });
  const { showAlert } = useAlert();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // État des données
  const [userName, setUserName] = useState('');
  const [userNameError, setUserNameError] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [postalCodeError, setPostalCodeError] = useState('');
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState<{ age: number }[]>([]);
  const [cats, setCats] = useState(0);
  const [dogs, setDogs] = useState(0);
  const [selectedStores, setSelectedStores] = useState<string[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<EquipmentOption[]>([]);
  const [selectedDiet, setSelectedDiet] = useState<DietOption[]>([]);
  const [excludedIngredients, setExcludedIngredients] = useState<string[]>([]);
  const [ingredientSearch, setIngredientSearch] = useState('');
  const [ingredientSearchModalVisible, setIngredientSearchModalVisible] = useState(false);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  
  // Modal pour l'âge de l'enfant
  const [childAgeModalVisible, setChildAgeModalVisible] = useState(false);
  const [selectedChildIndex, setSelectedChildIndex] = useState<number | null>(null);
  const [tempChildAge, setTempChildAge] = useState('');

  const progress = currentStep / STEPS;

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    } else {
      router.back();
    }
  };

  const validatePostalCode = (code: string): boolean => {
    // Format canadien: A1A 1A1 ou A1A1A1
    const canadianPostalRegex = /^[A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d$/;
    return canadianPostalRegex.test(code);
  };

  const formatPostalCode = (text: string): string => {
    // Enlever tous les espaces et convertir en majuscules
    const cleaned = text.replace(/\s/g, '').toUpperCase();
    
    // Limiter à 6 caractères
    const limited = cleaned.slice(0, 6);
    
    // Ajouter l'espace après le 3ème caractère
    if (limited.length > 3) {
      return `${limited.slice(0, 3)} ${limited.slice(3)}`;
    }
    return limited;
  };

  const handlePostalCodeChange = (text: string) => {
    const formatted = formatPostalCode(text);
    setPostalCode(formatted);
    setPostalCodeError('');
  };

  const handleNext = async () => {
    // Validation du nom à l'étape 1
    if (currentStep === 1) {
      if (!userName.trim()) {
        setUserNameError('Veuillez entrer votre nom');
        return;
      }
    }
    
    // Validation du code postal à l'étape 2
    if (currentStep === 2) {
      if (!postalCode.trim()) {
        setPostalCodeError('Veuillez entrer votre code postal');
        return;
      }
      if (!validatePostalCode(postalCode)) {
        setPostalCodeError('Code postal invalide. Format attendu: A1A 1A1');
        return;
      }
    }

    if (currentStep < STEPS) {
      setCurrentStep(currentStep + 1);
    } else {
      // Fin de l'onboarding - sauvegarder et rediriger
      await completeOnboarding();
    }
  };

  const completeOnboarding = async (enableNotifications: boolean = false) => {
    setLoading(true);
    
    // Demander les permissions de notifications si l'utilisateur a accepté
    if (enableNotifications) {
      try {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        
        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        
        if (finalStatus !== 'granted') {
          showAlert('Notifications', 'Impossible d\'activer les notifications. Vous pouvez les activer plus tard dans les paramètres.');
        }
      } catch (error) {
        console.error('Error requesting notification permissions:', error);
      }
    }
    
    const data: OnboardingData = {
      userName: userName.trim(),
      postalCode,
      household: {
        adults,
        children: children,
        pets: [
          ...Array(cats).fill({ type: 'cat' as const }),
          ...Array(dogs).fill({ type: 'dog' as const }),
        ],
      },
      stores: selectedStores,
      equipment: selectedEquipment,
      diet: selectedDiet,
      excludedIngredients,
      notifications: enableNotifications,
    };

    const { data: { user } } = await supabase.auth.getUser();
await onboardingService.savePreferences({
  userId: user?.id,
  userName: data.userName,
  postalCode: data.postalCode,
  selectedStores: data.stores,
  dietaryRestrictions: data.diet,
  householdAdults: data.household.adults,
  householdChildren: data.household.children.length,
  notificationsEnabled: data.notifications,
});
    
    setLoading(false);
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    await AsyncStorage.removeItem('needs_onboarding');
    router.replace('/(tabs)/circulaire');
  };

  const handleSubscription = async (planType: 'monthly' | 'yearly') => {
    setSubscriptionLoading(true);
    try {
      const offering = await revenueCatService.getOfferings();
      if (!offering?.availablePackages?.length) {
        showAlert('Erreur', 'Aucun plan disponible. Veuillez réessayer.');
        setSubscriptionLoading(false);
        return;
      }
      const pkg = offering.availablePackages.find((p: any) =>
        planType === 'monthly'
          ? p.identifier.includes('monthly') || p.identifier === '$rc_monthly'
          : p.identifier.includes('annual') || p.identifier.includes('yearly') || p.identifier === '$rc_annual'
      ) || offering.availablePackages[0];
      const { success, error } = await revenueCatService.purchasePackage(pkg);
      if (success) {
        setCurrentStep(currentStep + 1);
      } else if (error && !error.userCancelled) {
        showAlert('Erreur', "Impossible de completer l'achat. Veuillez reessayer.");
      }
    } catch (err) {
      showAlert('Erreur', 'Une erreur est survenue.');
    }
    setSubscriptionLoading(false);
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

  const toggleStore = (store: string) => {
    setSelectedStores(prev =>
      prev.includes(store) ? prev.filter(s => s !== store) : [...prev, store]
    );
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

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.title}>Quel est ton nom?</Text>
            <Text style={styles.subtitle}>
              Nous aimerions savoir comment t'appeler.
            </Text>
            <TextInput
              style={[styles.input, userNameError && styles.inputError]}
              placeholder="Ton prénom"
              placeholderTextColor={colors.textSecondary}
              value={userName}
              onChangeText={(text) => {
                setUserName(text);
                setUserNameError('');
              }}
              keyboardType="default"
              autoCapitalize="words"
            />
            {userNameError ? (
              <View style={styles.errorContainer}>
                <MaterialIcons name="error-outline" size={16} color={colors.error} />
                <Text style={styles.errorText}>{userNameError}</Text>
              </View>
            ) : null}
          </View>
        );

      case 2:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.title}>Ta région</Text>
            <Text style={styles.subtitle}>
              Partage-nous ton code postal afin que nous puissions adapter les offres à ta localisation.
            </Text>
            <TextInput
              style={[styles.input, postalCodeError && styles.inputError]}
              placeholder="Code postal (ex: H3Z 2Y7)"
              placeholderTextColor={colors.textSecondary}
              value={postalCode}
              onChangeText={handlePostalCodeChange}
              keyboardType="default"
              autoCapitalize="characters"
              maxLength={7}
            />
            {postalCodeError ? (
              <View style={styles.errorContainer}>
                <MaterialIcons name="error-outline" size={16} color={colors.error} />
                <Text style={styles.errorText}>{postalCodeError}</Text>
              </View>
            ) : null}
          </View>
        );

      case 3:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.title}>Ton foyer</Text>
            <Text style={styles.subtitle}>
              Pour combien de personnes faites-vous généralement les courses?
            </Text>

            {/* Adultes */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Adultes</Text>
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
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Enfants</Text>
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
              <Text style={styles.helperText}>Appuyez pour saisir l'âge</Text>
            </View>

            {/* Animaux */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Animaux</Text>
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
        );

      case 4:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.title}>Tes épiceries</Text>
            <Text style={styles.subtitle}>
              Quelles sont les épiceries dans lesquelles tu souhaites faire tes achats?
            </Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.gridContainer}>
                {['metro', 'iga', 'superc', 'loblaws', 'walmart', 'maxi'].map(store => (
                  <Pressable
                    key={store}
                    onPress={() => toggleStore(store)}
                    style={[styles.gridItem, selectedStores.includes(store) && styles.gridItemActive]}
                  >
                    <Text style={[styles.gridItemText, selectedStores.includes(store) && styles.gridItemTextActive]}>
                      {store === 'superc' ? 'Super C' : store === 'superc' ? 'Super C' : store.charAt(0).toUpperCase() + store.slice(1)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>
        );

      case 5:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.title}>Ta cuisine</Text>
            <Text style={styles.subtitle}>
              Quels sont les équipements que tu as chez toi?
            </Text>
            <View style={styles.equipmentGrid}>
              <Pressable
                onPress={() => toggleEquipment('oven')}
                style={styles.equipmentItem}
              >
                <View style={[styles.equipmentIcon, selectedEquipment.includes('oven') && styles.equipmentIconActive]}>
                  <Text style={styles.equipmentEmoji}>🔥</Text>
                </View>
                <Text style={styles.equipmentLabel}>Four</Text>
              </Pressable>

              <Pressable
                onPress={() => toggleEquipment('microwave')}
                style={styles.equipmentItem}
              >
                <View style={[styles.equipmentIcon, selectedEquipment.includes('microwave') && styles.equipmentIconActive]}>
                  <Text style={styles.equipmentEmoji}>📻</Text>
                </View>
                <Text style={styles.equipmentLabel}>Micro-ondes</Text>
              </Pressable>

              <Pressable
                onPress={() => toggleEquipment('stovetop')}
                style={styles.equipmentItem}
              >
                <View style={[styles.equipmentIcon, selectedEquipment.includes('stovetop') && styles.equipmentIconActive]}>
                  <Text style={styles.equipmentEmoji}>🍳</Text>
                </View>
                <Text style={styles.equipmentLabel}>Plaques de cuisson</Text>
              </Pressable>

              <Pressable
                onPress={() => toggleEquipment('blender')}
                style={styles.equipmentItem}
              >
                <View style={[styles.equipmentIcon, selectedEquipment.includes('blender') && styles.equipmentIconActive]}>
                  <Text style={styles.equipmentEmoji}>🥤</Text>
                </View>
                <Text style={styles.equipmentLabel}>Mixeur</Text>
              </Pressable>

              <Pressable
                onPress={() => toggleEquipment('multicooker')}
                style={styles.equipmentItem}
              >
                <View style={[styles.equipmentIcon, selectedEquipment.includes('multicooker') && styles.equipmentIconActive]}>
                  <Text style={styles.equipmentEmoji}>🍲</Text>
                </View>
                <Text style={styles.equipmentLabel}>Multi cooker</Text>
              </Pressable>

              <Pressable
                onPress={() => toggleEquipment('airfryer')}
                style={styles.equipmentItem}
              >
                <View style={[styles.equipmentIcon, selectedEquipment.includes('airfryer') && styles.equipmentIconActive]}>
                  <Text style={styles.equipmentEmoji}>💨</Text>
                </View>
                <Text style={styles.equipmentLabel}>Air-fryer</Text>
              </Pressable>
            </View>
          </View>
        );

      case 6:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.title}>Ton régime</Text>
            <Text style={styles.subtitle}>As-tu un régime particulier?</Text>
            <View style={styles.dietGrid}>
              <Pressable
                onPress={() => toggleDiet('dairy-free')}
                style={styles.dietItem}
              >
                <View style={[styles.dietIcon, selectedDiet.includes('dairy-free') && styles.dietIconActive]}>
                  <Text style={styles.dietEmoji}>🥛</Text>
                  <View style={styles.strikethrough} />
                </View>
                <Text style={styles.dietLabel}>Sans produit laitier</Text>
              </Pressable>

              <Pressable
                onPress={() => toggleDiet('gluten-free')}
                style={styles.dietItem}
              >
                <View style={[styles.dietIcon, selectedDiet.includes('gluten-free') && styles.dietIconActive]}>
                  <Text style={styles.dietEmoji}>🌾</Text>
                  <View style={styles.strikethrough} />
                </View>
                <Text style={styles.dietLabel}>Sans gluten</Text>
              </Pressable>

              <Pressable
                onPress={() => toggleDiet('pork-free')}
                style={styles.dietItem}
              >
                <View style={[styles.dietIcon, selectedDiet.includes('pork-free') && styles.dietIconActive]}>
                  <Text style={styles.dietEmoji}>🐷</Text>
                  <View style={styles.strikethrough} />
                </View>
                <Text style={styles.dietLabel}>Sans porc</Text>
              </Pressable>

              <Pressable
                onPress={() => toggleDiet('peanut_free')}
                style={styles.dietItem}
              >
                <View style={[styles.dietIcon, selectedDiet.includes('peanut_free') && styles.dietIconActive]}>
                  <Text style={styles.dietEmoji}>🥜</Text>
                </View>
                <Text style={styles.dietLabel}>Sans arachides</Text>
              </Pressable>

              <Pressable
                onPress={() => toggleDiet('vegetarian')}
                style={styles.dietItem}
              >
                <View style={[styles.dietIcon, selectedDiet.includes('vegetarian') && styles.dietIconActive]}>
                  <Text style={styles.dietEmoji}>🥕</Text>
                </View>
                <Text style={styles.dietLabel}>Végétarien</Text>
              </Pressable>

              <Pressable
                onPress={() => toggleDiet('pescatarian')}
                style={styles.dietItem}
              >
                <View style={[styles.dietIcon, selectedDiet.includes('pescatarian') && styles.dietIconActive]}>
                  <Text style={styles.dietEmoji}>🐟</Text>
                </View>
                <Text style={styles.dietLabel}>Pesco-végétarien</Text>
              </Pressable>
            </View>
          </View>
        );

      case 7:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.title}>Quels sont les ingrédients que tu n'aimes pas?</Text>
            <Text style={styles.subtitle}>As-tu un régime particulier?</Text>
            
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
              
              {/* Afficher les ingrédients personnalisés ajoutés */}
              {excludedIngredients
                .filter(ing => !COMMON_INGREDIENTS.some(common => common.label === ing))
                .map(ingredient => (
                  <Pressable
                    key={ingredient}
                    onPress={() => toggleIngredient(ingredient)}
                    style={[styles.ingredientChip, styles.ingredientChipActive]}
                  >
                    <Text style={[styles.ingredientLabel, styles.ingredientLabelActive]}>{ingredient}</Text>
                    <MaterialIcons 
                      name="remove" 
                      size={20} 
                      color={colors.surface} 
                    />
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
        );

      case 8:
        // Calculer les économies : 1250$ × (adultes + enfants de plus de 6 ans)
        const childrenOver6 = children.filter(child => child.age > 6).length;
        const totalPeople = adults + childrenOver6;
        const totalSavings = 1250 * totalPeople;
        
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.title}>L'abonnement te fait économiser plus</Text>
            <Text style={styles.subtitle}>
              Les abonnés sauvent en moyenne de {totalSavings.toLocaleString('fr-CA')} $ par année pour un foyer de {totalPeople}.
            </Text>

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

            <Pressable onPress={handleNext} style={styles.skipLink}>
              <Text style={styles.skipLinkText}>Non merci</Text>
            </Pressable>
          </View>
        );

      case 9:
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Image
        source={require('../assets/images/legumes.png')}
        style={{ width: '120%', height: 600, marginBottom: -250, marginHorizontal: -100 }}
        resizeMode="fit"
      />
      <Text style={styles.title}>Bienvenue à bord!</Text>
      <Text style={styles.subtitle}>
        On s'occupe de tout et on vous tient informé juste quand il faut. Acceptes-tu que nous t'envoyions des notifications?
      </Text>
      <Pressable
        onPress={() => completeOnboarding(true)}
        style={styles.notificationYesButton}
        disabled={loading}
      >
        {loading ? <ActivityIndicator size="small" color={colors.surface} /> : <Text style={styles.notificationYesButtonText}>Oui, bien sûre!</Text>}
      </Pressable>
      <Pressable
        onPress={() => completeOnboarding(false)}
        style={styles.notificationNoButton}
        disabled={loading}
      >
        <Text style={styles.notificationNoButtonText}>Non merci</Text>
      </Pressable>
    </View>
  );
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
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

      {/* Header with progress */}
      <View style={styles.header}>
        <Pressable onPress={handleBack} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={28} color={colors.text} />
        </Pressable>
        <View style={styles.progressBarContainer}>
          <View style={[styles.progressBar, { width: `${progress * 100}%` }]} />
        </View>
      </View>

      {/* Content */}
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {renderStep()}
      </ScrollView>

      {/* Footer button - masqué pour l'écran 9 (Bienvenue à bord) */}
      {currentStep !== STEPS && (
        <View style={styles.footer}>
          <Pressable
            onPress={handleNext}
            style={({ pressed }) => [
              styles.confirmButton,
              pressed && { opacity: 0.8 },
            ]}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color={colors.surface} />
            ) : (
              <Text style={styles.confirmButtonText}>Confirmer</Text>
            )}
          </Pressable>
        </View>
      )}
    </SafeAreaView>
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
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  backButton: {
    padding: spacing.xs,
  },
  progressBarContainer: {
    flex: 1,
    height: 8,
    backgroundColor: colors.border,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: borderRadius.full,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xl,
  },
  stepContainer: {
    alignItems: 'center',
  },
  title: {
    fontSize: 40,
    fontWeight: '400',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.md,
    fontFamily: 'InstrumentSerif_400Regular',
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '400',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.xxl,
    lineHeight: 24,
    fontFamily: 'OpenSans_400Regular',
    ...Platform.select({
      ios: {},
      android: {},
      default: { fontFamily: 'System' },
    }),
  },
  input: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    textAlign: 'center',
  },
  inputError: {
    borderColor: colors.error,
    borderWidth: 2,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  errorText: {
    fontSize: 14,
    color: colors.error,
  },
  section: {
    width: '100%',
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  counterRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  counterIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  counterIconActive: {
    // Active state handled by icon color
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
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    justifyContent: 'center',
  },
  gridItem: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderWidth: 2,
    borderColor: colors.border,
  },
  gridItemActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  gridItemText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  gridItemTextActive: {
    color: colors.surface,
  },
  equipmentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
    justifyContent: 'center',
  },
  equipmentItem: {
    width: SCREEN_WIDTH / 3 - spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  equipmentIcon: {
    width: 70,
    height: 70,
    borderRadius: 35,
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
    fontSize: 32,
  },
  equipmentLabel: {
    fontSize: 13,
    color: colors.text,
    textAlign: 'center',
  },
  dietGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
    justifyContent: 'center',
  },
  dietItem: {
    width: SCREEN_WIDTH / 3 - spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  dietIcon: {
    width: 70,
    height: 70,
    borderRadius: 35,
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
    fontSize: 32,
  },
  strikethrough: {
    position: 'absolute',
    width: 60,
    height: 3,
    backgroundColor: colors.text,
    transform: [{ rotate: '-45deg' }],
  },
  dietLabel: {
    fontSize: 12,
    color: colors.text,
    textAlign: 'center',
  },
  ingredientChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.xl,
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
    fontSize: 20,
  },
  ingredientLabel: {
    fontSize: 14,
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
  welcomeImage: {
  width: '100%',
  height: 350,
  marginBottom: spacing.md,
},
  notificationYesButton: {
    backgroundColor: colors.accent,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xxl,
    alignItems: 'center',
    marginTop: spacing.xl,
    width: '100%',
  },
  notificationYesButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.surface,
  },
  notificationNoButton: {
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  notificationNoButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
    textDecorationLine: 'underline',
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  confirmButton: {
    backgroundColor: colors.accent,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.surface,
  },
  skipLink: {
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  skipLinkText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
    textDecorationLine: 'underline',
  },
});
