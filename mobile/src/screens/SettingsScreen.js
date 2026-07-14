import { useEffect, useState } from 'react';
import {
  Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';

import { SUPPORTED_LOCALES, i18n, setLocale, t } from '../i18n';
import { getServerUrl, queueStatus, setServerUrl } from '../sync/sync';
import modelMetadata from '../../assets/model/cattleman.json';
import { colors, radius, spacing, TOUCH_TARGET, typography } from '../theme';

export default function SettingsScreen({ navigation }) {
  const [locale, setLocaleState] = useState(i18n.locale);
  const [server, setServer] = useState('');
  const [queue, setQueue] = useState({ queued: 0, stuck: 0 });

  useEffect(() => {
    getServerUrl().then(setServer);
    queueStatus().then(setQueue);
  }, []);

  async function chooseLocale(code) {
    await setLocale(code);
    setLocaleState(code);
    // Screen titles are read at render time from the navigator options, so the
    // stack has to be re-rendered for a language change to take effect.
    navigation.reset({ index: 0, routes: [{ name: 'Capture' }] });
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={[typography.heading, styles.sectionTitle]}>{t('settings.language')}</Text>
      {SUPPORTED_LOCALES.map((option) => (
        <Pressable
          key={option.code}
          style={[styles.option, locale === option.code && styles.optionSelected]}
          onPress={() => chooseLocale(option.code)}
        >
          <Text style={[typography.body, locale === option.code && styles.optionSelectedText]}>
            {option.label}
          </Text>
          {locale === option.code && <Text style={styles.check}>✓</Text>}
        </Pressable>
      ))}

      <Text style={[typography.heading, styles.sectionTitle]}>{t('settings.serverUrl')}</Text>
      <TextInput
        style={styles.input}
        value={server}
        onChangeText={setServer}
        onBlur={() => setServerUrl(server)}
        autoCapitalize="none"
        keyboardType="url"
      />

      <Text style={[typography.heading, styles.sectionTitle]}>{t('settings.about')}</Text>
      <View style={styles.infoRow}>
        <Text style={typography.small}>{t('settings.modelVersion')}</Text>
        <Text style={typography.body}>
          {modelMetadata.arch} · {modelMetadata.classes.length} breeds
        </Text>
      </View>
      <View style={styles.infoRow}>
        <Text style={typography.small}>{t('settings.pendingRecords')}</Text>
        <Text style={typography.body}>{queue.queued}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.md, paddingBottom: spacing.xl },
  sectionTitle: { marginTop: spacing.lg, marginBottom: spacing.sm },
  option: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    minHeight: TOUCH_TARGET, paddingHorizontal: spacing.md,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    backgroundColor: colors.surface, marginBottom: spacing.sm,
  },
  optionSelected: { borderColor: colors.primary, borderWidth: 2 },
  optionSelectedText: { fontWeight: '700' },
  check: { color: colors.primary, fontSize: 18, fontWeight: '700' },
  input: {
    minHeight: TOUCH_TARGET, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm, fontSize: 16, color: colors.text,
  },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
});
