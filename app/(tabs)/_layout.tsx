import { MaterialIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Platform, View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '@/constants/theme';
import { useSubscription } from '@/hooks/useSubscription';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { isSubscribed, isTrial, isAdmin } = useSubscription();

  // Vérifier si l'utilisateur a accès (abonné ou en période d'essai)
  const hasAccess = isSubscribed || isTrial;

  const tabBarStyle = {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 70 + insets.bottom,
    paddingTop: 8,
    paddingBottom: 8,
    paddingHorizontal: 16,
    backgroundColor: '#1a1a1a',
    borderRadius: 24,
    borderTopWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  } as any;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle,
        tabBarActiveTintColor: '#D83A2E',
        tabBarInactiveTintColor: '#8B8B8B',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
          marginTop: 4,
        },
        tabBarShowLabel: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Recettes',
          tabBarIcon: ({ color, focused }) => (
            <MaterialIcons name="restaurant-menu" size={28} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="circulaire"
        options={{
          title: 'Circulaires',
          tabBarIcon: ({ color, focused }) => (
            <MaterialIcons name="local-offer" size={28} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="shopping"
        options={{
          title: 'Liste',
          tabBarShowLabel: true,
          tabBarIcon: ({ color, focused }) => (
            <View style={{
              position: 'absolute',
              top: -24,
              left: '50%',
              marginLeft: -36,
              alignItems: 'center',
              justifyContent: 'center',
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: colors.accent,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 8,
            }}>
              <MaterialIcons name="check" size={32} color="#FFFFFF" />
            </View>
          ),
          tabBarLabel: () => null,
        }}
      />
      <Tabs.Screen
        name="menu"
        options={{
          title: 'Menu',
          tabBarIcon: ({ color, focused }) => (
            <MaterialIcons name="menu-book" size={28} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Réglages',
          tabBarIcon: ({ color, focused }) => (
            <MaterialIcons name="settings" size={28} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          href: null, // Masquer complètement l'onglet admin des tabs
        }}
      />
    </Tabs>
  );
}
