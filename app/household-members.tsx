import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows } from '@/constants/theme';
import { useAuth, useAlert } from '@/template';
import { getSupabaseClient } from '@/template';

type HouseholdMember = {
  id: string;
  member_email: string;
  member_user_id: string | null;
  status: 'pending' | 'accepted' | 'declined';
  role: 'owner' | 'member';
  invited_at: string;
  accepted_at: string | null;
};

export default function HouseholdMembersScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const supabase = getSupabaseClient();

  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<HouseholdMember[]>([]);

  useEffect(() => {
    loadMembers();
  }, [user]);

  const loadMembers = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Charger tous les membres (acceptés et en attente)
      const { data, error } = await supabase
        .from('household_members')
        .select('*')
        .eq('household_owner_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading household members:', error);
        return;
      }

      const accepted = data?.filter(m => m.status === 'accepted') || [];
      const pending = data?.filter(m => m.status === 'pending') || [];

      setMembers(accepted);
      setPendingInvitations(pending);
    } catch (error) {
      console.error('Error in loadMembers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInviteMember = async () => {
    if (!user) return;

    const email = newMemberEmail.trim().toLowerCase();

    if (!email) {
      showAlert('Erreur', 'Veuillez entrer une adresse email');
      return;
    }

    if (!email.includes('@')) {
      showAlert('Erreur', 'Veuillez entrer une adresse email valide');
      return;
    }

    if (email === user.email) {
      showAlert('Erreur', 'Vous ne pouvez pas vous inviter vous-même');
      return;
    }

    try {
      setInviting(true);

      // Vérifier si cet email n'est pas déjà invité
      const { data: existing } = await supabase
        .from('household_members')
        .select('id, status')
        .eq('household_owner_id', user.id)
        .eq('member_email', email)
        .single();

      if (existing) {
        if (existing.status === 'pending') {
          showAlert('Information', 'Cette personne a déjà une invitation en attente');
        } else if (existing.status === 'accepted') {
          showAlert('Information', 'Cette personne fait déjà partie de votre foyer');
        } else {
          showAlert('Information', 'Cette personne a décliné votre invitation précédente');
        }
        return;
      }

      // Créer l'invitation
      const { error } = await supabase
        .from('household_members')
        .insert({
          household_owner_id: user.id,
          member_email: email,
          status: 'pending',
          role: 'member',
        });

      if (error) throw error;

      // Envoyer l'email d'invitation via Edge Function
      try {
        console.log('[invite] inviteeEmail:', email, 'inviterEmail:', user.email);
const { data: { session } } = await supabase.auth.getSession();
const { error: emailError } = await supabase.functions.invoke('send-household-invitation', {
  headers: { Authorization: `Bearer ${session?.access_token}` },
  body: {
            inviterName: user.username || user.email.split('@')[0],
            inviterEmail: user.email,
            inviteeEmail: email,
          },
        });

        if (emailError) {
  console.error('Error sending invitation email:', JSON.stringify(emailError));
  showAlert('Succès', `Invitation envoyée à ${email}`);
} else {
  showAlert('Succès', `Invitation envoyée par email à ${email}`);
}
      } catch (emailError) {
        console.error('Error calling send-household-invitation:', emailError);
        showAlert('Invitation créée', `L'invitation a été créée mais l'email n'a pas pu être envoyé`);
      }

      setNewMemberEmail('');
      await loadMembers();
    } catch (error: any) {
      console.error('Error inviting member:', error);
      showAlert('Erreur', error.message || 'Impossible d\'envoyer l\'invitation');
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveMember = async (memberId: string, email: string) => {
    Alert.alert(
      'Retirer le membre',
      `Voulez-vous vraiment retirer ${email} de votre foyer ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Retirer',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('household_members')
                .delete()
                .eq('id', memberId);

              if (error) throw error;

              showAlert('Succès', 'Membre retiré du foyer');
              await loadMembers();
            } catch (error: any) {
              console.error('Error removing member:', error);
              showAlert('Erreur', error.message || 'Impossible de retirer le membre');
            }
          },
        },
      ]
    );
  };

  const handleCancelInvitation = async (invitationId: string, email: string) => {
    Alert.alert(
      'Annuler l\'invitation',
      `Voulez-vous annuler l'invitation envoyée à ${email} ?`,
      [
        { text: 'Non', style: 'cancel' },
        {
          text: 'Oui, annuler',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('household_members')
                .delete()
                .eq('id', invitationId);

              if (error) throw error;

              showAlert('Succès', 'Invitation annulée');
              await loadMembers();
            } catch (error: any) {
              console.error('Error canceling invitation:', error);
              showAlert('Erreur', error.message || 'Impossible d\'annuler l\'invitation');
            }
          },
        },
      ]
    );
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
          <Text style={styles.title}>Membres du foyer</Text>
          <Text style={styles.subtitle}>
            Partagez vos listes et économies
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
            {/* Info Card */}
            <View style={styles.infoCard}>
              <MaterialIcons name="info-outline" size={24} color={colors.primary} />
              <Text style={styles.infoText}>
                Les membres de votre foyer peuvent accéder à vos listes de courses et voir vos économies
              </Text>
            </View>

            {/* Add Member Form */}
            <View style={styles.addMemberSection}>
              <Text style={styles.sectionTitle}>Inviter un membre</Text>
              <View style={styles.inputContainer}>
                <MaterialIcons name="email" size={20} color={colors.textSecondary} />
                <TextInput
                  style={styles.input}
                  placeholder="Adresse email du membre"
                  placeholderTextColor={colors.textLight}
                  value={newMemberEmail}
                  onChangeText={setNewMemberEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
              <Pressable
                onPress={handleInviteMember}
                disabled={inviting || !newMemberEmail.trim()}
                style={({ pressed }) => [
                  styles.inviteButton,
                  pressed && { opacity: 0.9 },
                  (inviting || !newMemberEmail.trim()) && { opacity: 0.6 },
                ]}
              >
                {inviting ? (
                  <ActivityIndicator size="small" color={colors.surface} />
                ) : (
                  <>
                    <MaterialIcons name="send" size={20} color={colors.surface} />
                    <Text style={styles.inviteButtonText}>Envoyer l'invitation</Text>
                  </>
                )}
              </Pressable>
            </View>

            {/* Current Owner */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Propriétaire du compte</Text>
              <View style={styles.memberCard}>
                <View style={styles.memberIconContainer}>
                  <MaterialIcons name="person" size={24} color={colors.accent} />
                </View>
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>Vous</Text>
                  <Text style={styles.memberEmail}>{user.email}</Text>
                </View>
                <View style={styles.ownerBadge}>
                  <Text style={styles.ownerBadgeText}>Propriétaire</Text>
                </View>
              </View>
            </View>

            {/* Active Members */}
            {members.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  Membres actifs ({members.length})
                </Text>
                {members.map(member => (
                  <View key={member.id} style={styles.memberCard}>
                    <View style={styles.memberIconContainer}>
                      <MaterialIcons name="person" size={24} color={colors.primary} />
                    </View>
                    <View style={styles.memberInfo}>
                      <Text style={styles.memberName}>{member.member_email}</Text>
                      <Text style={styles.memberMeta}>
                        Membre depuis {new Date(member.accepted_at || member.invited_at).toLocaleDateString('fr-CA')}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => handleRemoveMember(member.id, member.member_email)}
                      style={({ pressed }) => [
                        styles.removeButton,
                        pressed && { opacity: 0.7 },
                      ]}
                      hitSlop={8}
                    >
                      <MaterialIcons name="close" size={20} color={colors.error} />
                    </Pressable>
                  </View>
                ))}
              </View>
            )}

            {/* Pending Invitations */}
            {pendingInvitations.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  Invitations en attente ({pendingInvitations.length})
                </Text>
                {pendingInvitations.map(invitation => (
                  <View key={invitation.id} style={[styles.memberCard, styles.pendingCard]}>
                    <View style={[styles.memberIconContainer, styles.pendingIcon]}>
                      <MaterialIcons name="schedule" size={24} color={colors.textSecondary} />
                    </View>
                    <View style={styles.memberInfo}>
                      <Text style={styles.memberName}>{invitation.member_email}</Text>
                      <Text style={styles.memberMeta}>
                        Invité le {new Date(invitation.invited_at).toLocaleDateString('fr-CA')}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => handleCancelInvitation(invitation.id, invitation.member_email)}
                      style={({ pressed }) => [
                        styles.cancelButton,
                        pressed && { opacity: 0.7 },
                      ]}
                      hitSlop={8}
                    >
                      <MaterialIcons name="close" size={20} color={colors.textSecondary} />
                    </Pressable>
                  </View>
                ))}
              </View>
            )}

            {/* Empty State */}
            {members.length === 0 && pendingInvitations.length === 0 && (
              <View style={styles.emptyState}>
                <MaterialIcons name="group-add" size={64} color={colors.textLight} />
                <Text style={styles.emptyText}>Aucun membre pour le moment</Text>
                <Text style={styles.emptySubtext}>
                  Invitez un membre de votre famille pour partager vos listes
                </Text>
              </View>
            )}
          </>
        )}

        <View style={{ height: spacing.xxl }} />
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
  addMemberSection: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.md,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    paddingVertical: spacing.md,
  },
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  inviteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.surface,
  },
  section: {
    marginBottom: spacing.lg,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  pendingCard: {
    backgroundColor: colors.surfaceLight,
  },
  memberIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.greenLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pendingIcon: {
    backgroundColor: colors.surfaceLight,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  memberEmail: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  memberMeta: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  ownerBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  ownerBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.surface,
  },
  removeButton: {
    padding: spacing.xs,
  },
  cancelButton: {
    padding: spacing.xs,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyText: {
    ...typography.h3,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  emptySubtext: {
    ...typography.caption,
    color: colors.textLight,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  errorText: {
    ...typography.h3,
    color: colors.textSecondary,
  },
});
