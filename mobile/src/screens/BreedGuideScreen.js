import { useMemo, useState } from 'react';
import {
  Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';

import breedInfo from '../../assets/breeds.json';
import { i18n, t } from '../i18n';
import { colors, radius, spacing, TOUCH_TARGET, typography } from '../theme';

/**
 * Offline breed reference.
 *
 * This is the part of the app that keeps working when the model is unsure and
 * when there is no signal — a worker can compare the animal in front of them
 * against the identifying features and decide for themselves. Care and feeding
 * notes are included because that is what the farmer actually asks about once
 * the breed is settled.
 */
export default function BreedGuideScreen() {
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(null);

  const locale = i18n.locale;

  const breeds = useMemo(() => {
    const entries = Object.entries(breedInfo).map(([key, info]) => ({
      key,
      ...info,
      displayName: info.names?.[locale] ?? info.names?.en ?? key,
    }));
    const needle = query.trim().toLowerCase();
    const matched = needle
      ? entries.filter((b) =>
          b.displayName.toLowerCase().includes(needle)
          || b.key.toLowerCase().includes(needle)
          || b.origin.toLowerCase().includes(needle))
      : entries;
    // Cattle first, then buffalo, alphabetically within each.
    return matched.sort((a, b) =>
      a.animalType === b.animalType
        ? a.displayName.localeCompare(b.displayName)
        : a.animalType.localeCompare(b.animalType));
  }, [query, locale]);

  function localised(field, fallbackKey) {
    return field?.[locale] ?? field?.en ?? fallbackKey;
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <TextInput
        style={styles.search}
        value={query}
        onChangeText={setQuery}
        placeholder={t('guide.search')}
        placeholderTextColor={colors.textMuted}
      />

      {breeds.map((breed) => {
        const open = expanded === breed.key;
        return (
          <View key={breed.key} style={styles.card}>
            <Pressable
              style={styles.cardHeader}
              onPress={() => setExpanded(open ? null : breed.key)}
            >
              <View style={styles.headerText}>
                <Text style={typography.heading}>{breed.displayName}</Text>
                <Text style={typography.small}>
                  {t(`guide.${breed.animalType}`)} · {breed.origin}
                </Text>
              </View>
              <Text style={styles.chevron}>{open ? '−' : '+'}</Text>
            </Pressable>

            {open && (
              <View style={styles.details}>
                <Detail label={t('guide.purpose')} value={breed.purpose} />
                <Detail
                  label={t('guide.milkYield')}
                  value={t('guide.milkYieldValue', { litres: breed.milkYieldLitres })}
                />

                <Text style={styles.detailLabel}>{t('guide.traits')}</Text>
                {(localised(breed.traits, []) || []).map((trait) => (
                  <Text key={trait} style={styles.bullet}>• {trait}</Text>
                ))}

                <Text style={styles.detailLabel}>{t('guide.care')}</Text>
                <Text style={typography.body}>{localised(breed.care, '')}</Text>
              </View>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

function Detail({ label, value }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabelInline}>{label}</Text>
      <Text style={[typography.body, styles.detailValue]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.md, paddingBottom: spacing.xl },
  search: {
    minHeight: TOUCH_TARGET, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm, fontSize: 16, color: colors.text,
    marginBottom: spacing.md,
  },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1,
    borderColor: colors.border, marginBottom: spacing.sm, overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center', padding: spacing.md,
    minHeight: TOUCH_TARGET,
  },
  headerText: { flex: 1 },
  chevron: { fontSize: 24, color: colors.primary, paddingHorizontal: spacing.sm },
  details: {
    paddingHorizontal: spacing.md, paddingBottom: spacing.md,
    borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm,
  },
  detailRow: { flexDirection: 'row', marginBottom: spacing.xs },
  detailLabelInline: { ...typography.small, width: 110 },
  detailValue: { flex: 1 },
  detailLabel: {
    ...typography.small, fontWeight: '700', marginTop: spacing.sm, marginBottom: spacing.xs,
  },
  bullet: { ...typography.body, marginBottom: 2 },
});
