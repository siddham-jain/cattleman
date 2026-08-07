import { useEffect, useState } from 'react';
import {
  Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { SUPPORTED_LOCALES, i18n, setLocale, t } from '../i18n';
import { getServerUrl, queueStatus, setServerUrl } from '../sync/sync';
import modelMetadata from '../../assets/model/cattleman.json';
import {
  colors, radius, shadow, spacing, TOUCH_TARGET, typography,
} from '../theme';

export default function SettingsScreen() {
  const [locale, setLocaleState] = useState(i18n.locale);
  const [server, setServer] = useState('');
  const [queue, setQueue] = useState({ queued: 0, stuck: 0 });

  useEffect(() => {
    getServerUrl().then(setServer);
    queueStatus().then(setQueue);
  }, []);

  async function chooseLocale(code) {
    setLocaleState(code);
    await setLocale(code);
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Section title={t('settings.language')} icon="language-outline">
        {SUPPORTED_LOCALES.map((option, index) => {
          const selected = locale === option.code;
          return (
            <Pressable
              key={option.code}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              style={[styles.row, index > 0 && styles.rowDivided]}
              onPress={() => chooseLocale(option.code)}
            >
              <Text style={[typography.body, selected && styles.rowSelected]}>
                {option.label}
              </Text>
              {selected && <Ionicons name="checkmark" size={20} color={colors.primary} />}
            </Pressable>
          );
        })}
      </Section>

      <Section title={t('settings.serverUrl')} icon="server-outline">
        <View style={styles.inputBlock}>
          <TextInput
            style={styles.input}
            value={server}
            onChangeText={setServer}
            onBlur={() => setServerUrl(server)}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            placeholderTextColor={colors.textMuted}
          />
          <Text style={typography.small}>{t('settings.serverHint')}</Text>
        </View>
      </Section>

      <Section title={t('settings.about')} icon="information-circle-outline">
        <InfoRow label={t('settings.modelVersion')} value={modelMetadata.arch} />
        <InfoRow label={t('settings.breedCount')}
                 value={String(modelMetadata.classes.length)} divided />
        <InfoRow label={t('settings.pendingRecords')} value={String(queue.queued)} divided />
      </Section>
    </ScrollView>
  );
}

function Section({ title, icon, children }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Ionicons name={icon} size={16} color={colors.textMuted} />
        <Text style={typography.label}>{title}</Text>
      </View>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function InfoRow({ label, value, divided }) {
  return (
    <View style={[styles.row, divided && styles.rowDivided]}>
      <Text style={typography.body}>{label}</Text>
      <Text style={[typography.small, styles.infoValue]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.md, paddingBottom: spacing.xl },
  section: { marginBottom: spacing.lg },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    paddingHorizontal: spacing.md, ...shadow,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    minHeight: TOUCH_TARGET, gap: spacing.sm,
  },
  rowDivided: { borderTopWidth: 1, borderTopColor: colors.border },
  rowSelected: { fontWeight: '700', color: colors.primary },
  inputBlock: { paddingVertical: spacing.md, gap: spacing.sm },
  input: {
    minHeight: TOUCH_TARGET, fontSize: 16, color: colors.text,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    backgroundColor: colors.background, paddingHorizontal: spacing.md,
  },
  infoValue: { color: colors.text, fontWeight: '600' },
});
