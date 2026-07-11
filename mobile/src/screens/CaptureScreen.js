import { useState } from 'react';
import {
  ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { classify } from '../inference/classifier';
import { decodePixels } from '../inference/decode';
import { t } from '../i18n';
import { colors, radius, spacing, TOUCH_TARGET, typography } from '../theme';

export default function CaptureScreen({ navigation }) {
  const [photo, setPhoto] = useState(null);
  const [busy, setBusy] = useState(false);

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

    const asset = result.assets[0];
    setPhoto(asset.uri);
    await identify(asset.uri);
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
      <Text style={typography.title}>{t('capture.title')}</Text>
      <Text style={[typography.small, styles.instructions]}>{t('capture.instructions')}</Text>

      <View style={styles.preview}>
        {photo
          ? <Image source={{ uri: photo }} style={styles.image} resizeMode="cover" />
          : <Text style={typography.small}>{t('capture.instructions')}</Text>}
        {busy && (
          <View style={styles.busyOverlay}>
            <ActivityIndicator size="large" color={colors.primaryText} />
            <Text style={styles.busyText}>{t('capture.analysing')}</Text>
          </View>
        )}
      </View>

      <Pressable style={[styles.button, styles.primaryButton]}
                 disabled={busy} onPress={() => pick(true)}>
        <Text style={styles.primaryButtonText}>{t('capture.takePhoto')}</Text>
      </Pressable>
      <Pressable style={styles.button} disabled={busy} onPress={() => pick(false)}>
        <Text style={styles.buttonText}>{t('capture.choosePhoto')}</Text>
      </Pressable>

      <View style={styles.links}>
        <Pressable style={styles.link} onPress={() => navigation.navigate('Registry')}>
          <Text style={styles.linkText}>{t('nav.registry')}</Text>
        </Pressable>
        <Pressable style={styles.link} onPress={() => navigation.navigate('BreedGuide')}>
          <Text style={styles.linkText}>{t('nav.guide')}</Text>
        </Pressable>
        <Pressable style={styles.link} onPress={() => navigation.navigate('Settings')}>
          <Text style={styles.linkText}>{t('nav.settings')}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.md, gap: spacing.sm },
  instructions: { marginBottom: spacing.sm },
  preview: {
    height: 280, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', marginBottom: spacing.md,
  },
  image: { width: '100%', height: '100%' },
  busyOverlay: {
    ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(31,27,22,0.65)',
    alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
  },
  busyText: { color: colors.primaryText, fontSize: 16 },
  button: {
    minHeight: TOUCH_TARGET, borderRadius: radius.md, borderWidth: 1,
    borderColor: colors.border, backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  primaryButton: { backgroundColor: colors.primary, borderColor: colors.primary },
  buttonText: { ...typography.body, fontWeight: '600' },
  primaryButtonText: { color: colors.primaryText, fontSize: 16, fontWeight: '700' },
  links: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.lg },
  link: { minHeight: TOUCH_TARGET, justifyContent: 'center', paddingHorizontal: spacing.sm },
  linkText: { color: colors.primary, fontSize: 15, fontWeight: '600' },
});
