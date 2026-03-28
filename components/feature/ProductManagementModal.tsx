import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TextInput, ScrollView, Pressable, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';

interface ProductManagementModalProps {
  visible: boolean;
  productId: string | null;
  onClose: () => void;
  onSave: () => void;
}

export function ProductManagementModal({ visible, productId, onClose, onSave }: ProductManagementModalProps) {
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [category, setCategory] = useState('');
  const [unit, setUnit] = useState('unité');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && productId) {
      loadProduct();
    } else if (visible && !productId) {
      setName(''); setBrand(''); setCategory(''); setUnit('unité');
    }
  }, [visible, productId]);

  const loadProduct = async () => {
    if (!productId) return;
    setLoading(true);
    const { data } = await supabase.from('products').select('*').eq('id', productId).single();
    if (data) {
      setName(data.name || '');
      setBrand(data.brand || '');
      setCategory(data.category || '');
      setUnit(data.unit || 'unité');
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('Erreur', 'Le nom est requis'); return; }
    setSaving(true);
    try {
      if (productId) {
        await supabase.from('products').update({ name: name.trim(), brand, category, unit }).eq('id', productId);
      } else {
        await supabase.from('products').insert({ name: name.trim(), brand, category, unit });
      }
      onSave();
      onClose();
    } catch (err: any) {
      Alert.alert('Erreur', err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>{productId ? 'Modifier produit' : 'Nouveau produit'}</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <MaterialIcons name="close" size={24} color={colors.text} />
            </Pressable>
          </View>
          {loading ? (
            <ActivityIndicator style={{ marginVertical: 40 }} color={colors.primary} />
          ) : (
            <ScrollView contentContainerStyle={styles.form}>
              {[
                { label: 'Nom *', value: name, onChange: setName, placeholder: 'Ex: Tomates cerises' },
                { label: 'Marque', value: brand, onChange: setBrand, placeholder: 'Ex: Irresistibles' },
                { label: 'Catégorie', value: category, onChange: setCategory, placeholder: 'Ex: Légumes' },
                { label: 'Unité', value: unit, onChange: setUnit, placeholder: 'Ex: kg, g, unité' },
              ].map(field => (
                <View key={field.label} style={styles.field}>
                  <Text style={styles.label}>{field.label}</Text>
                  <TextInput
                    style={styles.input}
                    value={field.value}
                    onChangeText={field.onChange}
                    placeholder={field.placeholder}
                    placeholderTextColor={colors.textLight}
                  />
                </View>
              ))}
              <Pressable style={styles.saveButton} onPress={handleSave} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Sauvegarder</Text>}
              </Pressable>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  container: { backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { ...typography.h3, color: colors.text },
  form: { padding: spacing.lg, paddingBottom: 40 },
  field: { marginBottom: spacing.lg },
  label: { ...typography.bodyBold, color: colors.text, marginBottom: spacing.xs },
  input: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.md, padding: spacing.md, ...typography.body, color: colors.text },
  saveButton: { backgroundColor: colors.primary, borderRadius: borderRadius.full, padding: spacing.md, alignItems: 'center', marginTop: spacing.md },
  saveButtonText: { ...typography.bodyBold, color: '#fff' },
});
