import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Pressable, ActivityIndicator, Share, Clipboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows } from '@/constants/theme';
import { useAuth, useAlert } from '@/template';
import { referralService } from '@/services/referralService';

export default function ReferralScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const [code, setCode] = useState<string | null>(null);
  const [stats, setStats] = useState({ total: 0, completed: 0 });
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (user) loadReferralData();
  }, [user]);

  const loadReferralData = async () => {
    if (!user) return;
    setLoading(true);
    const [c, s] = await Promise.all([
      referralService.getOrCreateCode(user.id),
      referralService.getStats(user.id),
    ]);
    setCode(c);
    setStats(s);
    setLoading(false);
  };

  const handleCopyCode = () => {
    if (!code) return;
    Clipboard.setString(`https://bonplan.co/rejoindre?ref=${code}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (!user) return;
    await referralService.shareReferralLink(user.id);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Parrainer un ami</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <View style={styles.content}>
          {/* Hero */}
          <View style={styles.heroCard}>
            <Text style={styles.heroEmoji}>🎁</Text>
            <Text style={styles.heroTitle}>Partagez et économisez!</Text>
            <Text style={styles.heroSubtitle}>
              Invitez vos amis sur BonPlan. Chacun reçoit{'\n'}
              <Text style={styles.heroHighlight}>1 mois gratuit</Text> lorsqu'ils s'abonnent.
            </Text>
          </View>

          {/* Comment ça marche */}
          <View style={styles.stepsCard}>
            <Text style={styles.stepsTitle}>Comment ça marche</Text>
            {[
              { num: '1', text: 'Partagez votre lien unique avec vos amis' },
              { num: '2', text: 'Votre ami s\'inscrit et s\'abonne avec votre code' },
              { num: '3', text: 'Vous recevez tous les deux 1 mois gratuit!' },
            ].map(step => (
              <View key={step.num} style={styles.step}>
                <View style={styles.stepNum}>
                  <Text style={styles.stepNumText}>{step.num}</Text>
                </View>
                <Text style={styles.stepText}>{step.text}</Text>
              </View>
            ))}
          </View>

          {/* Statistiques */}
          {stats.completed > 0 && (
            <View style={styles.statsCard}>
              <Text style={styles.statsTitle}>Vos parrainages</Text>
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{stats.total}</Text>
                  <Text style={styles.statLabel}>Invitations</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{stats.completed}</Text>
                  <Text style={styles.statLabel}>Complétés</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: colors.primary }]}>{stats.completed}</Text>
                  <Text style={styles.statLabel}>Mois gagnés</Text>
                </View>
              </View>
            </View>
          )}

          {/* Code et boutons */}
          {code && (
            <View style={styles.codeCard}>
              <Text style={styles.codeLabel}>Votre code de parrainage</Text>
              <View style={styles.codeRow}>
                <Text style={styles.codeText}>{code}</Text>
                <Pressable style={styles.copyButton} onPress={handleCopyCode}>
                  <MaterialIcons name={copied ? "check" : "content-copy"} size={20} color={copied ? colors.primary : colors.textSecondary} />
                  <Text style={[styles.copyText, copied && { color: colors.primary }]}>
                    {copied ? 'Copié!' : 'Copier le lien'}
                  </Text>
                </Pressable>
              </View>
            </View>
          )}

          <Pressable style={styles.shareButton} onPress={handleShare}>
            <MaterialIcons name="share" size={22} color="#fff" />
            <Text style={styles.shareButtonText}>Partager mon lien</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  title: { fontSize: 36, fontWeight: '400', color: colors.text, fontFamily: 'InstrumentSerif_400Regular', textAlign: 'center' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { flex: 1, paddingHorizontal: spacing.lg, gap: spacing.md },
  heroCard: { backgroundColor: colors.darkBeige, borderRadius: borderRadius.xl, padding: spacing.xl, alignItems: 'center' },
  heroEmoji: { fontSize: 48, marginBottom: spacing.sm },
  heroTitle: { ...typography.h2, color: colors.text, marginBottom: spacing.sm, textAlign: 'center' },
  heroSubtitle: { ...typography.body, color: colors.textSecondary, textAlign: 'center', lineHeight: 24 },
  heroHighlight: { color: colors.primary, fontWeight: '700' },
  stepsCard: { backgroundColor: colors.surface, borderRadius: borderRadius.xl, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  stepsTitle: { ...typography.bodyBold, color: colors.text, marginBottom: spacing.md },
  step: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  stepNum: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
  stepNumText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  stepText: { ...typography.body, color: colors.text, flex: 1 },
  statsCard: { backgroundColor: colors.surface, borderRadius: borderRadius.xl, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  statsTitle: { ...typography.bodyBold, color: colors.text, marginBottom: spacing.md, textAlign: 'center' },
  statsRow: { flexDirection: 'row', alignItems: 'center' },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 28, fontWeight: '700', color: colors.text },
  statLabel: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  statDivider: { width: 1, height: 40, backgroundColor: colors.border },
  codeCard: { backgroundColor: colors.surface, borderRadius: borderRadius.xl, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  codeLabel: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.sm },
  codeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  codeText: { fontSize: 20, fontWeight: '700', color: colors.text, letterSpacing: 2 },
  copyButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  copyText: { ...typography.caption, color: colors.textSecondary, fontWeight: '600' },
  shareButton: { backgroundColor: colors.primary, borderRadius: borderRadius.full, paddingVertical: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  shareButtonText: { ...typography.bodyBold, color: '#fff', fontSize: 16 },
});
