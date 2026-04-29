import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, Text, Pressable } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { colors } from '@/constants/theme';

const TAB_CONFIG: Record<
  string,
  { title: string; icon: keyof typeof Ionicons.glyphMap; iconFilled: keyof typeof Ionicons.glyphMap; isFab?: boolean }
> = {
  index: { title: 'Recettes', icon: 'restaurant-outline', iconFilled: 'restaurant' },
  circulaire: { title: 'Circulaires', icon: 'pricetag-outline', iconFilled: 'pricetag' },
  shopping: { title: 'Liste', icon: 'cart', iconFilled: 'cart', isFab: true },
  menu: { title: 'Menu', icon: 'calendar-outline', iconFilled: 'calendar' },
  settings: { title: 'Réglages', icon: 'settings-outline', iconFilled: 'settings' },
};

const VISIBLE_ROUTES = ['index', 'circulaire', 'shopping', 'menu', 'settings'];

function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  const visible = state.routes.filter((r) => VISIBLE_ROUTES.includes(r.name));

  return (
    <View
      style={{
        position: 'absolute',
        bottom: 12 + insets.bottom,
        left: 12,
        right: 12,
        height: 64,
        backgroundColor: '#E8DBC8',
        borderRadius: 32,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 6,
      }}
    >
      {visible.map((route) => {
        const cfg = TAB_CONFIG[route.name];
        if (!cfg) return null;

        const realIndex = state.routes.findIndex((r) => r.key === route.key);
        const isFocused = state.index === realIndex;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name as never, route.params as never);
          }
        };

        const color = isFocused ? colors.accent : colors.textSecondary;

        if (cfg.isFab) {
          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
            >
              <View
                style={{
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 52,
                  height: 52,
                  borderRadius: 26,
                  backgroundColor: colors.accent,
                  transform: [{ translateY: -14 }],
                }}
              >
                <Ionicons name="cart" size={26} color="#FFFFFF" />
              </View>
            </Pressable>
          );
        }

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', height: '100%' }}
          >
            <Ionicons name={isFocused ? cfg.iconFilled : cfg.icon} size={22} color={color} />
            <Text
              style={{
                fontSize: 10,
                fontWeight: '600',
                marginTop: 4,
                letterSpacing: 0.1,
                color,
              }}
            >
              {cfg.title}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="circulaire" />
      <Tabs.Screen name="shopping" />
      <Tabs.Screen name="menu" />
      <Tabs.Screen name="settings" />
      <Tabs.Screen name="admin" options={{ href: null }} />
    </Tabs>
  );
}
