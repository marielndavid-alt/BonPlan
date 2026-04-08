import AsyncStorage from '@react-native-async-storage/async-storage';
import { referralService } from '@/services/referralService';
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as AppleAuthentication from 'expo-apple-authentication';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import { useAuth, useAlert, getSupabaseClient } from '@/template';

type AuthMode = 'connexion' | 'inscription';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signInWithPassword, operationLoading } = useAuth();
  const { showAlert } = useAlert();

  const [mode, setMode] = useState<AuthMode>('connexion');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleForgotPassword = async () => {
    if (!email) {
      showAlert('Email requis', 'Entrez votre email pour réinitialiser votre mot de passe.');
      return;
    }
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) showAlert('Erreur', error.message);
    else showAlert('Email envoyé!', 'Vérifiez votre boîte email pour réinitialiser votre mot de passe.');
  };

  const handleLogin = async () => {
    if (!email || !password) { showAlert('Erreur', 'Veuillez remplir tous les champs'); return; }
    const { error, user } = await signInWithPassword(email, password);
    if (error) {
      if (error.includes('Invalid login credentials')) {
        showAlert('Erreur de connexion', 'Email ou mot de passe incorrect. Si vous venez de créer votre compte, vérifiez votre email pour le confirmer.');
      } else {
        showAlert('Erreur', error);
      }
    } else if (user) {
      router.replace('/');
    }
  };

  const handleRegister = async () => {
    if (!email || !password || !confirmPassword) { showAlert('Erreur', 'Veuillez remplir tous les champs'); return; }
    if (password !== confirmPassword) { showAlert('Erreur', 'Les mots de passe ne correspondent pas'); return; }
    if (password.length < 6) { showAlert('Erreur', 'Le mot de passe doit contenir au moins 6 caractères'); return; }

    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.auth.signUp({ email, password });

      if (error) { showAlert("Erreur d'inscription", error.message); return; }

      // Appliquer le code de parrainage si présent
      if (data.user) {
        const pendingCode = await AsyncStorage.getItem('pending_referral_code');
        if (pendingCode) {
          await referralService.applyReferralCode(pendingCode, data.user.id);
          await AsyncStorage.removeItem('pending_referral_code');
        }
      }

      showAlert('Compte créé avec succès! 🎉', `Bienvenue ${email.split('@')[0]}! Tu peux maintenant te connecter.`);
      setMode('connexion');
      setConfirmPassword('');
    } catch (error: any) {
      showAlert('Erreur', error?.message || 'Une erreur est survenue');
    }
  };

  const handleAppleLogin = async () => {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken!,
      });
      if (error) showAlert('Erreur', error.message);
      else router.replace('/');
    } catch (e: any) {
      if (e.code !== 'ERR_REQUEST_CANCELED') {
        showAlert('Erreur', 'Connexion Apple impossible. Veuillez réessayer.');
      }
    }
  };



  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
<View style={styles.backgroundImage}>
        <LinearGradient colors={['rgba(0,0,0,0.4)', 'rgba(0,0,0,0.8)']} style={styles.gradient}>
          <ScrollView style={[styles.container, { paddingTop: insets.top }]} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.heroSection}>
              <Image source={require('@/assets/images/bon-plan-logo-blanc.png')} style={styles.logo} contentFit="contain" />
            </View>

            <View style={styles.formCard}>
              <View style={styles.tabContainer}>
                <Pressable onPress={() => setMode('connexion')} style={[styles.tab, mode === 'connexion' && styles.tabActive]}>
                  <Text style={[styles.tabText, mode === 'connexion' && styles.tabTextActive]}>Connexion</Text>
                </Pressable>
                <Pressable onPress={() => setMode('inscription')} style={[styles.tab, mode === 'inscription' && styles.tabActive]}>
                  <Text style={[styles.tabText, mode === 'inscription' && styles.tabTextActive]}>Inscription</Text>
                </Pressable>
              </View>

              <View style={styles.form}>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Adresse email</Text>
                  <TextInput style={styles.input} placeholder="votre@email.com" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" editable={!operationLoading} placeholderTextColor={colors.textLight} />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Mot de passe</Text>
                  <View style={styles.passwordContainer}>
                    <TextInput style={styles.passwordInput} placeholder="••••••••" value={password} onChangeText={setPassword} secureTextEntry={!showPassword} editable={!operationLoading} placeholderTextColor={colors.textLight} />
                    <Pressable style={styles.eyeButton} onPress={() => setShowPassword(!showPassword)}>
                      <MaterialIcons name={showPassword ? 'visibility' : 'visibility-off'} size={24} color={colors.textSecondary} />
                    </Pressable>
                  </View>
                </View>

                {mode === 'inscription' && (
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Confirmer le mot de passe</Text>
                    <View style={styles.passwordContainer}>
                      <TextInput style={styles.passwordInput} placeholder="••••••••" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry={!showConfirmPassword} editable={!operationLoading} placeholderTextColor={colors.textLight} />
                      <Pressable style={styles.eyeButton} onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                        <MaterialIcons name={showConfirmPassword ? 'visibility' : 'visibility-off'} size={24} color={colors.textSecondary} />
                      </Pressable>
                    </View>
                  </View>
                )}

                {mode === 'connexion' && (
                  <Pressable style={styles.forgotPassword} onPress={handleForgotPassword}>
                    <Text style={styles.forgotPasswordText}>Vous avez oublié votre mot de passe?</Text>
                  </Pressable>
                )}

                <Pressable
                  style={[styles.primaryButton, operationLoading && styles.buttonDisabled]}
                  onPress={() => mode === 'connexion' ? handleLogin() : handleRegister()}
                  disabled={operationLoading}
                >
                  {operationLoading ? <ActivityIndicator color={colors.surface} /> : (
                    <Text style={styles.primaryButtonText}>{mode === 'connexion' ? 'Se connecter' : 'Créer mon compte'}</Text>
                  )}
                </Pressable>

                {mode === 'connexion' && (
                  <>
                    <Text style={styles.dividerText}>ou</Text>
                    <AppleAuthentication.AppleAuthenticationButton
                      buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                      buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                      cornerRadius={30}
                      style={{ width: '100%', height: 48, marginBottom: 12 }}
                      onPress={handleAppleLogin}
                    />

                  </>
                )}
              </View>
            </View>
          </ScrollView>
        </LinearGradient>
</View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
backgroundImage: { flex: 1, width: '100%', height: '100%', backgroundColor: '#ff3131' },  gradient: { flex: 1 },
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, padding: spacing.lg, justifyContent: 'space-between', paddingBottom: spacing.xxl },
  heroSection: { alignItems: 'center', paddingTop: spacing.xxl, paddingBottom: spacing.xl },
  logo: { width: 280, height: 140 },
  formCard: { backgroundColor: 'rgba(255,255,255,0.98)', borderRadius: borderRadius.xl, padding: spacing.xl, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 12 },
  tabContainer: { flexDirection: 'row', backgroundColor: colors.background, borderRadius: borderRadius.lg, padding: 4, marginBottom: spacing.lg },
  tab: { flex: 1, paddingVertical: spacing.md, alignItems: 'center', borderRadius: borderRadius.md },
  tabActive: { backgroundColor: colors.surface, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  tabText: { ...typography.bodyBold, color: colors.textSecondary },
  tabTextActive: { color: colors.text },
  form: { marginTop: spacing.sm },
  inputGroup: { marginBottom: spacing.lg },
  label: { ...typography.caption, color: colors.text, marginBottom: spacing.xs, fontWeight: '600' },
  input: { backgroundColor: '#F9F9F9', borderWidth: 0, borderBottomWidth: 1, borderBottomColor: colors.border, borderRadius: 0, paddingVertical: spacing.md, paddingHorizontal: 0, ...typography.body, color: colors.text },
  passwordContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9F9F9', borderWidth: 0, borderBottomWidth: 1, borderBottomColor: colors.border, borderRadius: 0 },
  passwordInput: { flex: 1, paddingVertical: spacing.md, paddingLeft: 0, ...typography.body, color: colors.text },
  eyeButton: { padding: spacing.sm },
  forgotPassword: { alignSelf: 'flex-start', marginTop: spacing.sm, marginBottom: spacing.md },
  forgotPasswordText: { ...typography.caption, color: colors.primary, textDecorationLine: 'underline' },
  primaryButton: { backgroundColor: colors.primary, paddingVertical: spacing.lg, borderRadius: 30, alignItems: 'center', marginTop: spacing.lg, shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  buttonDisabled: { opacity: 0.6 },
  primaryButtonText: { ...typography.bodyBold, color: colors.surface, fontSize: 16 },
  dividerText: { textAlign: 'center', ...typography.caption, color: colors.textSecondary, marginVertical: spacing.lg },
  googleButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border, paddingVertical: spacing.md, borderRadius: 30, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2, columnGap: spacing.sm },
  googleButtonText: { ...typography.body, color: colors.text, fontWeight: '500' },
});