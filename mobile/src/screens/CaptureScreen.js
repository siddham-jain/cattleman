import { useState } from 'react';
import {
  ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';

import { classify, loadModel } from '../inference/classifier';
import { decodePixels } from '../inference/decode';
import { useModelStatus } from '../inference/status';
import { t } from '../i18n';
import Button from '../components/Button';
import ModelStatus from '../components/ModelStatus';
import { colors, radius, shadow, spacing, typography } from '../theme';

export default function CaptureScreen({ navigation }) {
  const [photo, setPhoto] = useState(null);
  const [busy, setBusy] = useState(false);
  const { phase, progress } = useModelStatus();
  const modelReady = phase === 'ready';

  async function pick(useCamera) {
    const permission = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t('capture.permissionNeeded'));
      return;
    }

    const picker = useCamera ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync;
    const result = await picker({ quality: 0.85, mediaTypes: ImagePicker.MediaTypeOptions.Images });
    if (result.canceled) return;

    setPhoto(result.assets[0].uri);
  }

  async function identify(uri) {
    setBusy(true);
    try {
      const ranked = await classify(uri, decodePixels);
      navigation.navigate('Result', { photoUri: uri, ranked });
    } catch (error) {
      // Inference runs entirely on device, so a failure here is a model or
      // decode problem, not a network one — say so rather than blaming the
      // connection, which would send the worker looking for signal.
      Alert.alert(t('common.error'), String(error?.message ?? error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.frame}>
        {photo ? (
          <Image source={{ uri: photo }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={styles.placeholder}>
            <Ionicons name="camera-outline" size={48} color={colors.textMuted} />
            <Text style={styles.placeholderTitle}>{t('capture.title')}</Text>
            <Text style={[typography.small, styles.placeholderHint]}>
              {t('capture.instructions')}
            </Text>
          </View>
        )}
        {busy && (
          <View style={styles.busyOverlay}>
            <ActivityIndicator size="large" color={colors.primaryText} />
            <Text style={styles.busyText}>
              {modelReady
                ? t('capture.analysing')
                : t('model.downloading', { percent: Math.round((progress ?? 0) * 100) })}
            </Text>
          </View>
        )}
      </View>

      {/* The model warms in the background at startup, so this is the only
          place the wait is visible. It stays out of the way once ready. */}
      <ModelStatus onRetry={() => loadModel().catch(() => {})} />

      {/* Identification is a separate step so the photo can be reviewed, and
          retaken, before it is spent on inference. */}
      {photo ? (
        <>
          <Button
            variant="primary"
            icon="sparkles"
            label={t('capture.identify')}
            busy={busy}
            onPress={() => identify(photo)}
          />
          <View style={styles.row}>
            <Button
              style={styles.rowItem}
              icon="camera-outline"
              label={t('capture.retake')}
              disabled={busy}
              onPress={() => pick(true)}
            />
            <Button
              style={styles.rowItem}
              icon="images-outline"
              label={t('capture.gallery')}
              disabled={busy}
              onPress={() => pick(false)}
            />
          </View>
        </>
      ) : (
        <>
          <Button
            variant="primary"
            icon="camera"
            label={t('capture.takePhoto')}
            disabled={busy}
            onPress={() => pick(true)}
          />
          <Button
            icon="images-outline"
            label={t('capture.choosePhoto')}
            disabled={busy}
            onPress={() => pick(false)}
          />
        </>
      )}

      <View style={styles.tip}>
        <Ionicons name="bulb-outline" size={18} color={colors.warning} />
        <Text style={[typography.small, styles.tipText]}>{t('capture.tip')}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.xl },
  frame: {
    aspectRatio: 4 / 3, borderRadius: radius.lg, backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    marginBottom: spacing.sm, ...shadow,
  },
  image: { width: '100%', height: '100%' },
  placeholder: { alignItems: 'center', gap: spacing.sm, padding: spacing.lg },
  placeholderTitle: { ...typography.title, textAlign: 'center' },
  placeholderHint: { textAlign: 'center', maxWidth: 260 },
  busyOverlay: {
    ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(25,22,20,0.7)',
    alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
  },
  busyText: { color: colors.primaryText, fontSize: 16, fontWeight: '600' },
  row: { flexDirection: 'row', gap: spacing.sm },
  rowItem: { flex: 1 },
  tip: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm,
    backgroundColor: colors.warningSoft, borderRadius: radius.md,
    padding: spacing.md, marginTop: spacing.sm,
  },
  tipText: { flex: 1, color: colors.text },
});
