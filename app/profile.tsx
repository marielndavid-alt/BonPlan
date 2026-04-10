import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows } from '@/constants/theme';
import { useAuth, useAlert } from '@/template';
import { getSupabaseClient } from '@/template';

type EditMode = 'none' | 'username' | 'postal' | 'email' | 'password';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, refreshSession } = useAuth();
  const { showAlert } = useAlert();
  const supabase = getSupabaseClient();

  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState<EditMode>('none');
  
  const [username, setUsername] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    loadUserData();
  }, [user]);

  const loadUserData = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('username')
        .eq('id', user.id)
        .single();
      if (profile?.username) setUsername(profile.username);

      const { data: preferences } = await supabase
        .from('user_preferences')
        .select('postal_code')
        .eq('user_id', user.id)
        .single();
      if (preferences?.postal_code) setPostalCode(preferences.postal_code);

      setEmail(user.email);
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveUsername = async () => {
    if (!user) return;
    if (!username.trim()) { showAlert('Erreur', 'Veuillez entrer un nom'); return; }
    try {
      setLoading(true);
      const { error } = await supabase.from('user_profiles').update({ username: username.trim() }).eq('id', user.id);
      if (error) throw error;
      showAlert('Succès', 'Nom mis à jour');
      setEditMode('none');
    } catch { showAlert('Erreur', 'Impossible de sauvegarder le nom'); }
    finally { setLoading(false); }
  };

  const handleSavePostalCode = async () => {
    if (!user) return;
    if (!postalCode.trim()) { showAlert('Erreur', 'Veuillez entrer un code postal'); return; }
    try {
      setLoading(true);
      const { error } = await supabase.from('user_preferences').upsert({ user_id: user.id, postal_code: postalCode.trim().toUpperCase(), updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
      if (error) throw error;
      showAlert('Succès', 'Code postal mis à jour');
      setEditMode('none');
    } catch { showAlert('Erreur', 'Impossible de sauvegarder le code postal'); }
    finally { setLoading(false); }
  };

  const handleChangeEmail = async () => {
    if (!email.trim() || !email.includes('@')) { showAlert('Erreur', 'Veuillez entrer un email valide'); return; }
    try {
      setLoading(true);
      const { error } = await supabase.auth.updateUser({ email: email.trim() });
      if (error) throw error;
      showAlert('Vérification requise', 'Un email de confirmation a été envoyé à votre nouvelle adresse');
      setEditMode('none');
      await refreshSession();
    } catch (error: any) { showAlert('Erreur', error.message || "Impossible de changer l'email"); }
    finally { setLoading(false); }
  };

  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) { showAlert('Erreur', 'Veuillez remplir tous les champs'); return; }
    if (newPassword.length < 6) { showAlert('Erreur', 'Le mot de passe doit contenir au moins 6 caractères'); return; }
    if (newPassword !== confirmPassword) { showAlert('Erreur', 'Les mots de passe ne correspondent pas'); return; }
    try {
      setLoading(true);
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      showAlert('Succès', 'Mot de passe mis à jour');
      setEditMode('none');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) { showAlert('Erreur', error.message || 'Impossible de changer le mot de passe'); }
    finally { setLoading(false); }
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
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.7 }]} hitSlop={12}>
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Mon profil</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        
        

        {/* Nom */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Nom d'affichage</Text>
            {editMode !== 'username' && (
              <Pressable onPress={() => setEditMode('username')} style={({ pressed }) => [styles.editButton, pressed && { opacity: 0.7 }]}>
                <MaterialIcons name="edit" size={20} color={colors.primary} />
              </Pressable>
            )}
          </View>
          {editMode === 'username' ? (
            <View style={styles.editContainer}>
              <TextInput style={styles.input} value={username} onChangeText={setUsername} placeholder="Votre nom" autoCapitalize="words" maxLength={50} />
              <View style={styles.editActions}>
                <Pressable onPress={() => { setEditMode('none'); loadUserData(); }} style={({ pressed }) => [styles.cancelButton, pressed && { opacity: 0.7 }]}>
                  <Text style={styles.cancelButtonText}>Annuler</Text>
                </Pressable>
                <Pressable onPress={handleSaveUsername} disabled={loading} style={({ pressed }) => [styles.saveButton, pressed && { opacity: 0.7 }]}>
                  {loading ? <ActivityIndicator size="small" color={colors.surface} /> : <Text style={styles.saveButtonText}>Sauvegarder</Text>}
                </Pressable>
              </View>
            </View>
          ) : (
            <Text style={styles.fieldValue}>{username || 'Non renseigné'}</Text>
          )}
        </View>

        {/* Code postal */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Code postal</Text>
            {editMode !== 'postal' && (
              <Pressable onPress={() => setEditMode('postal')} style={({ pressed }) => [styles.editButton, pressed && { opacity: 0.7 }]}>
                <MaterialIcons name="edit" size={20} color={colors.primary} />
              </Pressable>
            )}
          </View>
          {editMode === 'postal' ? (
            <View style={styles.editContainer}>
              <TextInput style={styles.input} value={postalCode} onChangeText={setPostalCode} placeholder="H1A 1A1" autoCapitalize="characters" maxLength={7} />
              <View style={styles.editActions}>
                <Pressable onPress={() => { setEditMode('none'); loadUserData(); }} style={({ pressed }) => [styles.cancelButton, pressed && { opacity: 0.7 }]}>
                  <Text style={styles.cancelButtonText}>Annuler</Text>
                </Pressable>
                <Pressable onPress={handleSavePostalCode} disabled={loading} style={({ pressed }) => [styles.saveButton, pressed && { opacity: 0.7 }]}>
                  {loading ? <ActivityIndicator size="small" color={colors.surface} /> : <Text style={styles.saveButtonText}>Sauvegarder</Text>}
                </Pressable>
              </View>
            </View>
          ) : (
            <Text style={styles.fieldValue}>{postalCode || 'Non renseigné'}</Text>
          )}
        </View>

        {/* Email */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Adresse email</Text>
            {editMode !== 'email' && (
              <Pressable onPress={() => setEditMode('email')} style={({ pressed }) => [styles.editButton, pressed && { opacity: 0.7 }]}>
                <MaterialIcons name="edit" size={20} color={colors.primary} />
              </Pressable>
            )}
          </View>
          {editMode === 'email' ? (
            <View style={styles.editContainer}>
              <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="votre@email.com" keyboardType="email-address" autoCapitalize="none" />
              <View style={styles.editActions}>
                <Pressable onPress={() => { setEditMode('none'); setEmail(user.email); }} style={({ pressed }) => [styles.cancelButton, pressed && { opacity: 0.7 }]}>
                  <Text style={styles.cancelButtonText}>Annuler</Text>
                </Pressable>
                <Pressable onPress={handleChangeEmail} disabled={loading} style={({ pressed }) => [styles.saveButton, pressed && { opacity: 0.7 }]}>
                  {loading ? <ActivityIndicator size="small" color={colors.surface} /> : <Text style={styles.saveButtonText}>Sauvegarder</Text>}
                </Pressable>
              </View>
            </View>
          ) : (
            <Text style={styles.fieldValue}>{user.email}</Text>
          )}
        </View>

        {/* Mot de passe */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Mot de passe</Text>
            {editMode !== 'password' && (
              <Pressable onPress={() => setEditMode('password')} style={({ pressed }) => [styles.editButton, pressed && { opacity: 0.7 }]}>
                <MaterialIcons name="edit" size={20} color={colors.primary} />
              </Pressable>
            )}
          </View>
          {editMode === 'password' ? (
            <View style={styles.editContainer}>
              <TextInput style={styles.input} value={newPassword} onChangeText={setNewPassword} placeholder="Nouveau mot de passe (min. 6 caractères)" secureTextEntry />
              <TextInput style={[styles.input, { marginTop: spacing.sm }]} value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Confirmer le nouveau mot de passe" secureTextEntry />
              <View style={styles.editActions}>
                <Pressable onPress={() => { setEditMode('none'); setNewPassword(''); setConfirmPassword(''); }} style={({ pressed }) => [styles.cancelButton, pressed && { opacity: 0.7 }]}>
                  <Text style={styles.cancelButtonText}>Annuler</Text>
                </Pressable>
                <Pressable onPress={handleChangePassword} disabled={loading} style={({ pressed }) => [styles.saveButton, pressed && { opacity: 0.7 }]}>
                  {loading ? <ActivityIndicator size="small" color={colors.surface} /> : <Text style={styles.saveButtonText}>Sauvegarder</Text>}
                </Pressable>
              </View>
            </View>
          ) : (
            <Text style={styles.fieldValue}>••••••••</Text>
          )}
        </View>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: colors.background },
  backButton: { padding: spacing.xs },
  title: { fontSize: 36, fontWeight: '400', color: colors.text, fontFamily: 'InstrumentSerif_400Regular', textAlign: 'left' },
  scrollView: { flex: 1 },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  section: { backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border, ...shadows.sm },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  sectionTitle: { ...typography.h3, color: colors.text },
  avatarSection: { alignItems: 'center', paddingVertical: spacing.md },
  avatarPlaceholder: { width: 100, height: 100, borderRadius: 50, backgroundColor: colors.accent, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.sm },
  avatarText: { fontSize: 40, fontWeight: '600', color: colors.surface },
  usernameLabel: { ...typography.bodyBold, color: colors.text },
  editButton: { padding: spacing.xs },
  fieldValue: { ...typography.body, color: colors.text },
  editContainer: { gap: spacing.md },
  input: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.md, padding: spacing.md, ...typography.body, color: colors.text },
  editActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  cancelButton: { flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, paddingVertical: spacing.sm, borderRadius: borderRadius.md, alignItems: 'center' },
  cancelButtonText: { ...typography.bodyBold, color: colors.textSecondary },
  saveButton: { flex: 1, backgroundColor: colors.accent, paddingVertical: spacing.sm, borderRadius: borderRadius.md, alignItems: 'center' },
  saveButtonText: { ...typography.bodyBold, color: colors.surface },
  errorText: { ...typography.h3, color: colors.textSecondary },
});