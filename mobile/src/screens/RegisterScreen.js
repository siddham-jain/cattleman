import { useEffect, useState } from 'react';
import {
  Alert, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet,
  Text, TextInput, View,
} from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';

import { saveAnimal } from '../db/database';
import { syncNow } from '../sync/sync';
import { t } from '../i18n';
import { breedName } from '../breeds';
import Button from '../components/Button';
import Pill from '../components/Pill';
import {
  animalTypeColor, colors, confidenceColor, radius, shadow, spacing,
  TOUCH_TARGET, typography,
} from '../theme';

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
      navigation.navigate('RegistryTab');
    } catch (error) {
      Alert.alert(t('common.error'), String(error?.message ?? error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.summary}>
          <Image source={{ uri: photoUri }} style={styles.thumb} resizeMode="cover" />
          <View style={styles.summaryText}>
            <Text style={typography.label}>{t('register.breed')}</Text>
            <Text style={typography.title} numberOfLines={1}>{breedName(breed)}</Text>
            <View style={styles.summaryPills}>
              <Pill label={t(`guide.${animalType}`)} color={animalTypeColor(animalType)} />
              <Pill
                label={t('result.confidence', { percent: Math.round(confidence * 100) })}
                color={confidenceColor(confidence)}
              />
            </View>
          </View>
        </View>

        <View style={styles.form}>
          <Field
            label={t('register.tagId')}
            value={tagId}
            onChangeText={setTagId}
            placeholder={t('register.tagIdHint')}
            autoCapitalize="characters"
          />
          <Field label={t('register.ownerName')} value={ownerName} onChangeText={setOwnerName} />
          <Field
            label={t('register.notes')}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
          />
        </View>

        <View style={styles.location}>
          <Ionicons
            name={coords ? 'location' : 'location-outline'}
            size={18}
            color={coords ? colors.primary : colors.textMuted}
          />
          <Text style={[typography.small, styles.locationText]}>
            {coords
              ? `${t('register.locationCaptured')} · ${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`
              : t('register.locationUnavailable')}
          </Text>
        </View>

        <Button
          variant="primary"
          icon="checkmark-circle-outline"
          label={t('register.save')}
          busy={saving}
          onPress={save}
        />
        <Text style={[typography.small, styles.offlineNote]}>{t('register.offlineNote')}</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, multiline, ...props }) {
  return (
    <View style={styles.field}>
      <Text style={typography.label}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.multiline]}
        placeholderTextColor={colors.textMuted}
        multiline={multiline}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { padding: spacing.md, paddingBottom: spacing.xl },
  summary: {
    flexDirection: 'row', gap: spacing.md, padding: spacing.sm,
    backgroundColor: colors.surface, borderRadius: radius.lg,
    marginBottom: spacing.lg, ...shadow,
  },
  thumb: {
    width: 96, height: 96, borderRadius: radius.md, backgroundColor: colors.surfaceMuted,
  },
  summaryText: { flex: 1, justifyContent: 'center', gap: spacing.xs },
  summaryPills: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
  form: { gap: spacing.md },
  field: { gap: spacing.xs },
  input: {
    minHeight: TOUCH_TARGET, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, backgroundColor: colors.surface,
    paddingHorizontal: spacing.md, fontSize: 16, color: colors.text,
  },
  multiline: { minHeight: 96, textAlignVertical: 'top', paddingTop: spacing.sm },
  location: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    marginTop: spacing.lg, marginBottom: spacing.lg,
  },
  locationText: { flex: 1 },
  offlineNote: { textAlign: 'center', marginTop: spacing.sm },
});
