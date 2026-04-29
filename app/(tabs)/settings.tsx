import { referralService } from '@/services/referralService';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Switch,
  Linking,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows } from '@/constants/theme';
import { useAuth, useAlert } from '@/template';
import { useRouter } from 'expo-router';
import { useFonts, InstrumentSerif_400Regular } from '@expo-google-fonts/instrument-serif';
import { getSupabaseClient } from '@/template';
import { useSubscription } from '@/hooks/useSubscription';
import { useNotifications } from '@/hooks/useNotifications';

type ProfileCardProps = {
  user: { id: string; email: string; username?: string };
};

const ProfileCard: React.FC<ProfileCardProps> = ({ user }) => {
  const supabase = getSupabaseClient();
  const { isSubscribed, isTrial } = useSubscription();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    loadAvatar();
  }, [user]);

  const loadAvatar = async () => {
    try {
      const { data } = await supabase
        .from('user_profiles')
        .select('avatar_url')
        .eq('id', user.id)
        .single();

      if (data?.avatar_url) {
        setAvatarUrl(data.avatar_url);
      }
    } catch (error) {
      console.error('Error loading avatar:', error);
    }
  };

  return (
    <View style={styles.profileCard}>
      
      <View style={styles.profileInfo}>
        <Text style={styles.profileName}>
          {user.username || 'Utilisateur'}
        </Text>
        <Text style={styles.profileEmail}>{user.email}</Text>
        {isSubscribed && (
          <View style={styles.userStatusRow}>
            <MaterialIcons name="check-circle" size={16} color={isTrial ? colors.accent : colors.success} />
            <Text style={[styles.badgeText, { color: isTrial ? colors.accent : colors.success }]}>
              {isTrial ? 'Essai gratuit' : 'Premium'}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

type SettingsItemProps = {
  icon: keyof typeof MaterialIcons.glyphMap;
  title: string;
  subtitle: string;
  onPress?: () => void;
  showChevron?: boolean;
  rightComponent?: React.ReactNode;
};

const SettingsItem: React.FC<SettingsItemProps> = ({ 
  icon, 
  title, 
  subtitle, 
  onPress,
  showChevron = true,
  rightComponent,
}) => (
  <Pressable
    onPress={onPress}
    style={({ pressed }) => [
      styles.menuItem,
      pressed && !rightComponent && { opacity: 0.7, transform: [{ scale: 0.98 }] },
    ]}
    disabled={!!rightComponent}
  >
    <View style={styles.iconContainer}>
      <MaterialIcons name={icon} size={24} color={colors.primary} />
    </View>
    <View style={styles.menuContent}>
      <Text style={styles.menuTitle}>{title}</Text>
      <Text style={styles.menuSubtitle}>{subtitle}</Text>
    </View>
    {rightComponent || (showChevron && (
      <MaterialIcons name="chevron-right" size={24} color={colors.textSecondary} />
    ))}
  </Pressable>
);

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout, loading: authLoading } = useAuth();
  const { showAlert } = useAlert();
  const { isSubscribed, isTrial } = useSubscription();
  const { isEnabled: notificationsEnabled, loading: notifLoading, toggleNotifications } = useNotifications();
  const [switchValue, setSwitchValue] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    setSwitchValue(notificationsEnabled);
  }, [notificationsEnabled]);

  const handleDeleteAccount = async () => {
    showAlert(
      'Supprimer mon compte',
      'Cette action est irréversible. Toutes vos données seront supprimées définitivement.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              const supabase = getSupabaseClient();
              await supabase.rpc('delete_user_account');
              await logout();
              router.replace('/login');
            } catch (error) {
              showAlert('Erreur', 'Impossible de supprimer le compte. Contactez hello@bonplan.co');
            }
          },
        },
      ]
    );
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      const { error } = await logout();
      if (error) {
        showAlert('Erreur', error);
        setIsLoggingOut(false);
        return;
      }
      // Rediriger vers l'écran de login après une déconnexion réussie
      setIsLoggingOut(false);
      router.replace('/login');
    } catch (err) {
      console.error('Logout error:', err);
      showAlert('Erreur', 'Impossible de se déconnecter. Veuillez réessayer.');
      setIsLoggingOut(false);
    }
  };

  const handleNavigateToProfile = () => {
    router.push('/profile');
  };

  const handleFeatureComingSoon = (feature: string) => {
    showAlert('Bientôt disponible', `${feature} sera disponible prochainement`);
  };
const handleReferral = async () => {
  if (!user) return;
  await referralService.shareReferralLink(user.id);
};
  const handleToggleNotifications = async (value: boolean) => {
    setSwitchValue(value);
    const success = await toggleNotifications(value);
    if (!success) {
      setSwitchValue(!value);
      showAlert(
        'Erreur',
        'Impossible d\'activer les notifications. Vérifiez les permissions dans les réglages de votre téléphone.'
      );
    } else {
      showAlert(
        'Succès',
        value
          ? 'Vous recevrez une notification chaque jeudi à 11h avec les nouveaux rabais!'
          : 'Les notifications hebdomadaires ont été désactivées.'
      );
    }
  };

  if (authLoading) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Hero Section */}
      <View style={[styles.hero, { paddingTop: insets.top + spacing.xl }]}>
        <Text style={styles.title}>Paramètres</Text>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingBottom: 100 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* User Profile Card */}
        {user && (
          <ProfileCard user={user} />
        )}

        {/* Menu Items */}
       
       <SettingsItem
  icon="person"
  title="Mon profil"
  subtitle="Email, mot de passe, code postal"
  onPress={handleNavigateToProfile}
/>

        <SettingsItem
          icon="settings"
          title="Mes préférences"
          subtitle="Foyer, régime, ingrédients exclus"
          onPress={() => router.push('/preferences')}
        />


        <SettingsItem
          icon="group-add"
          title="Membres du foyer"
          subtitle="Partager vos listes"
          onPress={() => router.push('/household-members')}
        />

        <SettingsItem
          icon="workspace-premium"
          title="Abonnement"
          subtitle="Gérer votre abonnement Premium"
          onPress={() => router.push('/subscription')}
        />


        
<SettingsItem
  icon="card-giftcard"
  title="Parrainer un ami"
  subtitle="Obtenez 1 mois gratuit chacun"
  onPress={() => router.push("/referral")}
/>
<SettingsItem
          icon="notifications-active"
          title="Notifications hebdomadaires"
          subtitle="Rabais du jeudi à 11h"
          showChevron={false}
          rightComponent={
            <Switch
              value={switchValue}
              onValueChange={handleToggleNotifications}
              trackColor={{ false: colors.border, true: colors.accentLight }}
              thumbColor={switchValue ? colors.accent : colors.textSecondary}
              disabled={notifLoading}
            />
          }
        />
        <SettingsItem
          icon="help-outline"
          title="Support"
          subtitle="Aide et assistance"
onPress={async () => {
  const url = 'mailto:hello@bonplan.co?subject=Support%20BonPlan';
  const canOpen = await Linking.canOpenURL(url);
  if (canOpen) {
    Linking.openURL(url);
  } else {
    showAlert('Support', 'Contactez-nous à hello@bonplan.co');
  }
}}
/>
{/* Logout Button */}
        {user && (          <Pressable
            style={({ pressed }) => [
              styles.logoutButton,
              pressed && !isLoggingOut && { opacity: 0.7 },
              isLoggingOut && { opacity: 0.6 },
            ]}
            onPress={handleLogout}
            disabled={isLoggingOut}
          >
            {isLoggingOut ? (
              <ActivityIndicator size="small" color={colors.error} />
            ) : (
              <MaterialIcons name="logout" size={20} color={colors.error} />
            )}
            <Text style={styles.logoutButtonText}>
              {isLoggingOut ? 'Déconnexion...' : 'Se déconnecter'}
            </Text>
          </Pressable>
        )}

        {user && (
          <Pressable
            style={({ pressed }) => [{ flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8, paddingVertical:16, marginHorizontal:16, marginBottom:8 }, pressed && { opacity: 0.7 }]}
            onPress={handleDeleteAccount}
          >
            <MaterialIcons name="delete-forever" size={20} color="#999" />
            <Text style={{ fontSize:14, color:'#999' }}>Supprimer mon compte</Text>
          </Pressable>
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
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  hero: {
    backgroundColor: colors.darkBeige, // Beige foncé #f1e7dd
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    borderBottomLeftRadius: borderRadius.xl,
    borderBottomRightRadius: borderRadius.xl,
  },
  title: {
    ...typography.h1,
    color: colors.text,
    marginBottom: spacing.xs,
    fontFamily: 'InstrumentSerif_400Regular',
    fontSize: 30,
    textAlign: 'left',
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.surface,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  profileEmail: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  userStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  badge: {
    backgroundColor: colors.success,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  trialBadge: {
    backgroundColor: colors.accent,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.surface,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.accentLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuContent: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  menuSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.error,
    marginTop: spacing.md,
  },
  logoutButtonText: {
    ...typography.bodyBold,
    color: colors.error,
  },
});
