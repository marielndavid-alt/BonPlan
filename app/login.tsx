import AsyncStorage from '@react-native-async-storage/async-storage';
import { referralService } from '@/services/referralService';
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView, Modal, Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useAuth, useAlert, getSupabaseClient } from '@/template';
import {
  useFonts,
  InstrumentSerif_400Regular,
  InstrumentSerif_400Regular_Italic,
} from '@expo-google-fonts/instrument-serif';
import {
  OpenSans_400Regular,
  OpenSans_500Medium,
  OpenSans_600SemiBold,
} from '@expo-google-fonts/open-sans';

const RED = '#E8402A';
const BEIGE = '#F5F0E8';
const WHITE = '#FFFFFF';
const { width, height } = Dimensions.get('window');

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signInWithPassword, operationLoading } = useAuth();
  const { showAlert } = useAlert();

  const [showEmailForm, setShowEmailForm] = useState(false);
  const [mode, setMode] = useState<'connexion' | 'inscription'>('connexion');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [fontsLoaded] = useFonts({
    InstrumentSerif_400Regular,
    InstrumentSerif_400Regular_Italic,
    OpenSans_400Regular,
    OpenSans_500Medium,
    OpenSans_600SemiBold,
  });

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
    const { error } = await signInWithPassword(email, password);
    if (error) {
      if (error.includes('Invalid login credentials')) {
        showAlert('Erreur de connexion', 'Email ou mot de passe incorrect.');
      } else {
        showAlert('Erreur', error);
      }
      return;
    }
    router.replace('/');
  };

  const handleRegister = async () => {
    if (!email || !password || !confirmPassword) { showAlert('Erreur', 'Veuillez remplir tous les champs'); return; }
    if (password !== confirmPassword) { showAlert('Erreur', 'Les mots de passe ne correspondent pas'); return; }
    if (password.length < 6) { showAlert('Erreur', 'Le mot de passe doit contenir au moins 6 caractères'); return; }
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) { showAlert("Erreur d'inscription", error.message); return; }
      if (data.user) {
        const pendingCode = await AsyncStorage.getItem('pending_referral_code');
        if (pendingCode) {
          await referralService.applyReferralCode(pendingCode, data.user.id);
          await AsyncStorage.removeItem('pending_referral_code');
        }
      }
      // Marquer que l'onboarding est requis
      const AsyncStorageModule = require('@react-native-async-storage/async-storage').default;
      await AsyncStorageModule.setItem('needs_onboarding', 'true');
      await signInWithPassword(email, password);
      router.replace('/onboarding');
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

  if (!fontsLoaded) return null;

  return (
    <View style={{ flex: 1, backgroundColor: RED }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.container}>
          {/* Bag — pleine largeur, touche le haut */}
          <Image
            source={require('../assets/images/login-bag.png')}
            style={styles.bagImage}
            contentFit="fill"
            contentPosition="top center"
          />

          {/* Tagline */}
          <View style={styles.taglineContainer}>
            <Text style={styles.tagline}>
              Le panier d'épicerie{'\n'}le <Text style={styles.taglineItalic}>moins cher,{'\n'}</Text>c'est ici!
            </Text>
          </View>

          {/* Boutons */}
          <View style={[styles.buttonsContainer, { paddingBottom: insets.bottom + 16 }]}>
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={100}
              style={styles.appleBtn}
              onPress={handleAppleLogin}
            />
            <Pressable style={styles.emailBtn} onPress={() => setShowEmailForm(true)}>
              <Text style={styles.emailBtnText}>Se connecter avec un email</Text>
            </Pressable>
            <Text style={styles.terms}>En vous connectant, vous acceptez nos Termes et conditions.</Text>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Modal email */}
      <Modal visible={showEmailForm} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setShowEmailForm(false)} style={styles.closeBtn}>
              <MaterialIcons name="close" size={24} color="#333" />
            </Pressable>
            <Text style={styles.modalTitle}>{mode === 'connexion' ? 'Connexion' : 'Inscription'}</Text>
            <View style={{ width: 40 }} />
          </View>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <View style={styles.tabContainer}>
              {(['connexion', 'inscription'] as const).map(m => (
                <Pressable key={m} style={[styles.tab, mode === m && styles.tabActive]} onPress={() => setMode(m)}>
                  <Text style={[styles.tabText, mode === m && styles.tabTextActive]}>
                    {m === 'connexion' ? 'Connexion' : 'Inscription'}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Adresse email</Text>
              <TextInput style={styles.input} placeholder="votre@email.com" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholderTextColor="#aaa" />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Mot de passe</Text>
              <View style={styles.passwordContainer}>
                <TextInput style={styles.passwordInput} placeholder="••••••••" value={password} onChangeText={setPassword} secureTextEntry={!showPassword} placeholderTextColor="#aaa" />
                <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                  <MaterialIcons name={showPassword ? 'visibility' : 'visibility-off'} size={22} color="#aaa" />
                </Pressable>
              </View>
            </View>
            {mode === 'inscription' && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Confirmer le mot de passe</Text>
                <TextInput style={styles.input} placeholder="••••••••" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry placeholderTextColor="#aaa" />
              </View>
            )}
            {mode === 'connexion' && (
              <Pressable onPress={handleForgotPassword} style={styles.forgotBtn}>
                <Text style={styles.forgotText}>Vous avez oublié votre mot de passe?</Text>
              </Pressable>
            )}
            <Pressable style={[styles.submitBtn, operationLoading && { opacity: 0.7 }]} onPress={() => mode === 'connexion' ? handleLogin() : handleRegister()} disabled={operationLoading}>
              {operationLoading ? <ActivityIndicator color={WHITE} /> : <Text style={styles.submitBtnText}>{mode === 'connexion' ? 'Se connecter' : 'Créer mon compte'}</Text>}
            </Pressable>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'flex-end' },
  bagImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    width: width,
    height: height * 0.90,
  },
  taglineContainer: { paddingHorizontal: 28, paddingBottom: 20 },
  tagline: { fontFamily: 'InstrumentSerif_400Regular', fontSize: 40, color: WHITE, textAlign: 'center', lineHeight: 50 },
  taglineItalic: { fontFamily: 'InstrumentSerif_400Regular_Italic', fontSize: 40, color: WHITE },
  buttonsContainer: { paddingHorizontal: 24, gap: 10 },
  appleBtn: { width: '100%', height: 54 },
  emailBtn: { paddingVertical: 12, alignItems: 'center' },
  emailBtnText: { fontFamily: 'OpenSans_500Medium', fontSize: 15, color: 'rgba(255,255,255,0.9)', textDecorationLine: 'underline' },
  terms: { fontFamily: 'OpenSans_400Regular', fontSize: 11, color: 'rgba(255,255,255,0.6)', textAlign: 'center', lineHeight: 16 },
  modalContainer: { flex: 1, backgroundColor: BEIGE },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#e5e5e5' },
  closeBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  modalTitle: { fontFamily: 'InstrumentSerif_400Regular', fontSize: 20, color: '#1a1a1a' },
  modalContent: { padding: 24 },
  tabContainer: { flexDirection: 'row', backgroundColor: '#e8e3da', borderRadius: 12, padding: 4, marginBottom: 28 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  tabActive: { backgroundColor: WHITE, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  tabText: { fontFamily: 'OpenSans_400Regular', fontSize: 14, color: '#888' },
  tabTextActive: { fontFamily: 'OpenSans_600SemiBold', fontSize: 14, color: '#1a1a1a' },
  inputGroup: { marginBottom: 20 },
  label: { fontFamily: 'OpenSans_600SemiBold', fontSize: 12, color: '#555', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: WHITE, borderRadius: 12, padding: 16, fontFamily: 'OpenSans_400Regular', fontSize: 15, color: '#1a1a1a', borderWidth: 1.5, borderColor: '#e5e5e5' },
  passwordContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: WHITE, borderRadius: 12, borderWidth: 1.5, borderColor: '#e5e5e5' },
  passwordInput: { flex: 1, padding: 16, fontFamily: 'OpenSans_400Regular', fontSize: 15, color: '#1a1a1a' },
  eyeBtn: { padding: 16 },
  forgotBtn: { alignSelf: 'flex-start', marginBottom: 8 },
  forgotText: { fontFamily: 'OpenSans_400Regular', fontSize: 13, color: RED, textDecorationLine: 'underline' },
  submitBtn: { backgroundColor: RED, borderRadius: 100, paddingVertical: 16, alignItems: 'center', marginTop: 16 },
  submitBtnText: { fontFamily: 'OpenSans_600SemiBold', fontSize: 16, color: WHITE },
});