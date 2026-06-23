import { useEffect, useState } from 'react';
import {
  Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import * as Location from 'expo-location';

import { saveAnimal } from '../db/database';
import { syncNow } from '../sync/sync';
import { i18n, t } from '../i18n';
import breedInfo from '../../assets/breeds.json';
import { colors, radius, spacing, TOUCH_TARGET, typography } from '../theme';

export default function RegisterScreen({ route, navigation }) {
  const { photoUri, ranked, breed, animalType, confidence } = route.params;
  const [tagId, setTagId] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [notes, setNotes] = useState('');
  const [coords, setCoords] = useState(null);
  const [saving, setSaving] = useState(false);

  // Location is requested up front but is strictly optional: registrations must
  // succeed with GPS off or unavailable indoors, so a denial is recorded as
  // "unavailable" rather than blocking the form.
  useEffect(() => {
    (async () => {
      try {
        const { granted } = await Location.requestForegroundPermissionsAsync();
        if (!granted) return;
        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setCoords({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      } catch {
        setCoords(null);
      }
    })();
  }, []);

  const localName = breedInfo[breed]?.names?.[i18n.locale]
    ?? breedInfo[breed]?.names?.en ?? breed;

  async function save() {
    setSaving(true);
    try {
      await saveAnimal({
        breed,
        animalType,
        confidence,
        ranked,
        photoUri,
        tagId: tagId.trim() || null,
        ownerName: ownerName.trim() || null,
        notes: notes.trim() || null,
        latitude: coords?.latitude ?? null,
        longitude: coords?.longitude ?? null,
      });
      // Opportunistic push; the record is already safe locally either way.
      syncNow().catch(() => {});
      Alert.alert(t('register.saved'));
      navigation.navigate('Registry');
    } catch (error) {
      Alert.alert(t('common.error'), String(error?.message ?? error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.summary}>
        <Image source={{ uri: photoUri }} style={styles.thumb} resizeMode="cover" />
        <View style={styles.summaryText}>
          <Text style={typography.small}>{t('register.breed')}</Text>
          <Text style={typography.title}>{localName}</Text>
          <Text style={typography.small}>
            {t('result.confidence', { percent: Math.round(confidence * 100) })}
          </Text>
        </View>
      </View>

      <Text style={styles.label}>{t('register.tagId')}</Text>
      <TextInput
        style={styles.input}
        value={tagId}
        onChangeText={setTagId}
        placeholder={t('register.tagIdHint')}
        placeholderTextColor={colors.textMuted}
        autoCapitalize="characters"
      />

      <Text style={styles.label}>{t('register.ownerName')}</Text>
      <TextInput style={styles.input} value={ownerName} onChangeText={setOwnerName} />

      <Text style={styles.label}>{t('register.notes')}</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        value={notes}
        onChangeText={setNotes}
        multiline
        numberOfLines={3}
      />

      <Text style={styles.location}>
        {coords
          ? `${t('register.locationCaptured')} · ${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`
          : t('register.locationUnavailable')}
      </Text>

      <Pressable style={[styles.button, saving && styles.buttonDisabled]}
                 disabled={saving} onPress={save}>
        <Text style={styles.buttonText}>{t('register.save')}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.md, paddingBottom: spacing.xl },
  summary: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
  thumb: { width: 96, height: 96, borderRadius: radius.md },
  summaryText: { flex: 1, justifyContent: 'center' },
  label: { ...typography.small, marginBottom: spacing.xs, marginTop: spacing.sm },
  input: {
    minHeight: TOUCH_TARGET, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm, fontSize: 16, color: colors.text,
  },
  multiline: { minHeight: 88, textAlignVertical: 'top', paddingTop: spacing.sm },
  location: { ...typography.small, marginTop: spacing.md, marginBottom: spacing.md },
  button: {
    minHeight: TOUCH_TARGET, borderRadius: radius.md, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: colors.primaryText, fontSize: 16, fontWeight: '700' },
});
