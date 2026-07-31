import { useMemo, useRef, useState } from 'react';
import {
  FlatList, Image, LayoutAnimation, Platform, Pressable, StyleSheet,
  Text, TextInput, UIManager, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { listBreeds, localised } from '../breeds';
import { i18n, t } from '../i18n';
import Pill from '../components/Pill';
import {
  animalTypeColor, colors, radius, shadow, spacing, TOUCH_TARGET, typography,
} from '../theme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const FILTERS = ['all', 'cattle', 'buffalo'];

/**
 * Offline breed reference.
 *
 * This is the part of the app that keeps working when the model is unsure and
 * when there is no signal — a worker can compare the animal in front of them
 * against the photo and the identifying features, and decide for themselves.
 *
 * A card carries a thumbnail closed and the full photo open, because the picture
 * is the first thing anyone checks and the text is what settles it.
 */
export default function BreedGuideScreen() {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [expanded, setExpanded] = useState(null);
  const listRef = useRef(null);

  const locale = i18n.locale;

  const breeds = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return listBreeds()
      .filter((breed) => filter === 'all' || breed.animalType === filter)
      .filter((breed) => !needle
        || breed.displayName.toLowerCase().includes(needle)
        || breed.key.toLowerCase().includes(needle)
        || breed.origin.toLowerCase().includes(needle)
        || breed.originName.toLowerCase().includes(needle));
  }, [query, filter, locale]);

  function toggle(key, index) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const opening = expanded !== key;
    setExpanded(opening ? key : null);
    // A card opened near the bottom would grow off-screen, so bring it up to
    // where the photo and the features below it are both readable.
    if (opening) {
      listRef.current?.scrollToIndex({ index, viewPosition: 0, animated: true });
    }
  }

  return (
    <FlatList
      ref={listRef}
      data={breeds}
      keyExtractor={(breed) => breed.key}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <View style={styles.header}>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={18} color={colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder={t('guide.search')}
              placeholderTextColor={colors.textMuted}
              returnKeyType="search"
            />
            {query.length > 0 && (
              <Pressable onPress={() => setQuery('')} hitSlop={10}>
                <Ionicons name="close-circle" size={18} color={colors.textMuted} />
              </Pressable>
            )}
          </View>

          <View style={styles.filters}>
            {FILTERS.map((option) => {
              const active = filter === option;
              return (
                <Pressable
                  key={option}
                  onPress={() => setFilter(option)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {t(`guide.filter.${option}`)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Ionicons name="search-outline" size={36} color={colors.textMuted} />
          <Text style={typography.small}>{t('guide.noResults')}</Text>
        </View>
      }
      onScrollToIndexFailed={() => {}}
      renderItem={({ item: breed, index }) => (
        <BreedCard
          breed={breed}
          open={expanded === breed.key}
          onToggle={() => toggle(breed.key, index)}
        />
      )}
    />
  );
}

function BreedCard({ breed, open, onToggle }) {
  const typeColor = animalTypeColor(breed.animalType);

  return (
    <View style={styles.card}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={breed.displayName}
        style={({ pressed }) => [styles.cardHeader, pressed && styles.cardHeaderPressed]}
      >
        {/* Closed, the photo is a thumbnail beside the name; open, it moves to
            the full-width image below. One tap moves it either way. */}
        {!open && <Image source={breed.image} style={styles.thumb} resizeMode="cover" />}
        <View style={styles.headerText}>
          <Text style={typography.heading} numberOfLines={1}>{breed.displayName}</Text>
          <Text style={typography.small} numberOfLines={1}>{breed.originName}</Text>
        </View>
        <Pill label={t(`guide.${breed.animalType}`)} color={typeColor} />
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={colors.textMuted}
        />
      </Pressable>

      {open && (
        <View>
          {/* contain, not cover: a crop that cuts the horns or the back line
              removes the very features the list below asks you to check. */}
          <Image source={breed.image} style={styles.hero} resizeMode="contain" />

          <View style={styles.details}>
            <View style={styles.facts}>
              <Fact icon="ribbon-outline" label={t('guide.purpose')} value={breed.purposeName} />
              <Fact
                icon="water-outline"
                label={t('guide.milkYield')}
                value={t('guide.milkYieldValue', { litres: breed.milkYieldLitres })}
              />
            </View>

            <Text style={styles.sectionLabel}>{t('guide.traits')}</Text>
            {localised(breed.traits, []).map((trait) => (
              <View key={trait} style={styles.bulletRow}>
                <View style={[styles.bulletDot, { backgroundColor: typeColor }]} />
                <Text style={[typography.body, styles.bulletText]}>{trait}</Text>
              </View>
            ))}

            <Text style={styles.sectionLabel}>{t('guide.care')}</Text>
            <Text style={typography.body}>{localised(breed.care, '')}</Text>

            <Pressable onPress={onToggle} style={styles.collapse} accessibilityRole="button">
              <Ionicons name="chevron-up" size={16} color={colors.primary} />
              <Text style={styles.collapseText}>{t('guide.collapse')}</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

function Fact({ icon, label, value }) {
  return (
    <View style={styles.fact}>
      <Ionicons name={icon} size={16} color={colors.textMuted} />
      <View style={styles.factText}>
        <Text style={typography.label}>{label}</Text>
        <Text style={[typography.body, styles.factValue]}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.md, paddingBottom: spacing.xl },
  header: { gap: spacing.sm, marginBottom: spacing.md },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    minHeight: TOUCH_TARGET, paddingHorizontal: spacing.md,
    borderRadius: radius.pill, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
  },
  searchInput: { flex: 1, fontSize: 16, color: colors.text, paddingVertical: spacing.sm },
  filters: { flexDirection: 'row', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...typography.small, color: colors.text, fontWeight: '600' },
  chipTextActive: { color: colors.primaryText },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    marginBottom: spacing.sm, overflow: 'hidden', ...shadow,
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    padding: spacing.sm, paddingRight: spacing.md, minHeight: 72,
  },
  cardHeaderPressed: { backgroundColor: colors.surfaceMuted },
  thumb: { width: 56, height: 56, borderRadius: radius.md, backgroundColor: colors.surfaceMuted },
  headerText: { flex: 1, gap: 2, marginLeft: spacing.xs },
  hero: {
    width: '100%', aspectRatio: 16 / 9, maxHeight: 180,
    backgroundColor: colors.surfaceMuted,
  },
  details: { padding: spacing.md, gap: spacing.xs },
  facts: { gap: spacing.sm, marginBottom: spacing.sm },
  fact: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  factText: { flex: 1 },
  factValue: { marginTop: 2 },
  sectionLabel: { ...typography.label, marginTop: spacing.md, marginBottom: spacing.xs },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: 4 },
  bulletDot: { width: 6, height: 6, borderRadius: 3, marginTop: 9 },
  bulletText: { flex: 1 },
  collapse: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.xs, minHeight: TOUCH_TARGET, marginTop: spacing.sm,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  collapseText: { ...typography.small, color: colors.primary, fontWeight: '700' },
  empty: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.xl },
});
