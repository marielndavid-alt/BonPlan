import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TextInput, ScrollView, Pressable, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';

interface RecipeManagementModalProps {
  visible: boolean;
  recipeId: string | null;
  onClose: () => void;
  onSave: () => void;
}

export function RecipeManagementModal({ visible, recipeId, onClose, onSave }: RecipeManagementModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState('');
  const [category, setCategory] = useState('main');
  const [prepTime, setPrepTime] = useState('30');
  const [servings, setServings] = useState('4');
  const [tags, setTags] = useState('');
  const [instructions, setInstructions] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && recipeId) {
      loadRecipe();
    } else if (visible && !recipeId) {
      setTitle(''); setDescription(''); setImage(''); setCategory('main');
      setPrepTime('30'); setServings('4'); setTags(''); setInstructions('');
    }
  }, [visible, recipeId]);

  const loadRecipe = async () => {
    if (!recipeId) return;
    setLoading(true);
    const { data } = await supabase.from('recipes').select('*').eq('id', recipeId).single();
    if (data) {
      setTitle(data.title || '');
      setDescription(data.description || '');
      setImage(data.image || '');
      setCategory(data.category || 'main');
      setPrepTime(String(data.prep_time || 30));
      setServings(String(data.servings || 4));
      setTags((data.tags || []).join(', '));
      setInstructions(data.instructions || '');
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!title.trim()) { Alert.alert('Erreur', 'Le titre est requis'); return; }
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        description,
        image,
        category,
        prep_time: parseInt(prepTime) || 30,
        servings: parseInt(servings) || 4,
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
        instructions,
      };

      if (recipeId) {
        await supabase.from('recipes').update(payload).eq('id', recipeId);
      } else {
        await supabase.from('recipes').insert(payload);
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
            <Text style={styles.title}>{recipeId ? 'Modifier recette' : 'Nouvelle recette'}</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <MaterialIcons name="close" size={24} color={colors.text} />
            </Pressable>
          </View>
          {loading ? (
            <ActivityIndicator style={{ marginVertical: 40 }} color={colors.primary} />
          ) : (
            <ScrollView contentContainerStyle={styles.form}>
              {[
                { label: 'Titre *', value: title, onChange: setTitle, placeholder: 'Ex: Pâtes carbonara' },
                { label: 'Description', value: description, onChange: setDescription, placeholder: 'Courte description...', multiline: true },
                { label: 'URL Image', value: image, onChange: setImage, placeholder: 'https://...' },
                { label: 'Temps de prep (min)', value: prepTime, onChange: setPrepTime, placeholder: '30', keyboardType: 'numeric' as any },
                { label: 'Portions', value: servings, onChange: setServings, placeholder: '4', keyboardType: 'numeric' as any },
                { label: 'Tags (séparés par virgule)', value: tags, onChange: setTags, placeholder: 'végétarien, rapide, ...' },
              ].map(field => (
                <View key={field.label} style={styles.field}>
                  <Text style={styles.label}>{field.label}</Text>
                  <TextInput
                    style={[styles.input, field.multiline && styles.inputMultiline]}
                    value={field.value}
                    onChangeText={field.onChange}
                    placeholder={field.placeholder}
                    placeholderTextColor={colors.textLight}
                    multiline={field.multiline}
                    keyboardType={field.keyboardType}
                  />
                </View>
              ))}

              <View style={styles.field}>
                <Text style={styles.label}>Catégorie</Text>
                <View style={styles.categoryRow}>
                  {['main', 'snack'].map(cat => (
                    <Pressable
                      key={cat}
                      style={[styles.categoryButton, category === cat && styles.categoryButtonActive]}
                      onPress={() => setCategory(cat)}
                    >
                      <Text style={[styles.categoryButtonText, category === cat && styles.categoryButtonTextActive]}>
                        {cat === 'main' ? 'Plat principal' : 'Collation'}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Instructions</Text>
                <TextInput
                  style={[styles.input, styles.inputMultiline, { minHeight: 100 }]}
                  value={instructions}
                  onChangeText={setInstructions}
                  placeholder="Étapes de préparation..."
                  placeholderTextColor={colors.textLight}
                  multiline
                  textAlignVertical="top"
                />
              </View>

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
  container: { backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { ...typography.h3, color: colors.text },
  form: { padding: spacing.lg, paddingBottom: 40 },
  field: { marginBottom: spacing.lg },
  label: { ...typography.bodyBold, color: colors.text, marginBottom: spacing.xs },
  input: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.md, padding: spacing.md, ...typography.body, color: colors.text },
  inputMultiline: { minHeight: 60, textAlignVertical: 'top' },
  categoryRow: { flexDirection: 'row', gap: spacing.sm },
  categoryButton: { flex: 1, padding: spacing.md, borderRadius: borderRadius.md, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center' },
  categoryButtonActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  categoryButtonText: { ...typography.captionBold, color: colors.text },
  categoryButtonTextActive: { color: '#fff' },
  saveButton: { backgroundColor: colors.primary, borderRadius: borderRadius.full, padding: spacing.md, alignItems: 'center', marginTop: spacing.md },
  saveButtonText: { ...typography.bodyBold, color: '#fff' },
});
