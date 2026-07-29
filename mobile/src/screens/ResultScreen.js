import { useState } from 'react';
import {
  Image, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { t } from '../i18n';
import { breedImage, breedName } from '../breeds';
import Button from '../components/Button';
import Pill from '../components/Pill';
import {
  animalTypeColor, colors, confidenceColor, LOW_CONFIDENCE, radius, shadow,
  spacing, typography,
} from '../theme';

/**
 * Shows the ranked candidates rather than a single verdict.
 *
 * The model is right about two times in three, so presenting one breed as "the"
 * answer would overstate what it knows. A worker who can see the runners-up,
 * compare them against the reference photos, and override them ends up with
 * better data than one who is handed a guess.
 */
export default function ResultScreen({ route, navigation }) {
  const { photoUri, ranked } = route.params;
  const [chosen, setChosen] = useState(ranked[0].breed);

  const top = ranked[0];
  const uncertain = top.confidence < LOW_CONFIDENCE;
  const corrected = chosen !== top.breed;
  // A long tail of near-zero candidates is noise; the rest is available on tap.
  const [showAll, setShowAll] = useState(false);
  const candidates = showAll ? ranked : ranked.slice(0, 4);

  function proceed() {
    const selected = ranked.find((r) => r.breed === chosen) ?? ranked[0];
    navigation.navigate('Register', {
      photoUri,
      ranked,
      breed: selected.breed,
      animalType: selected.animalType,
      confidence: selected.confidence,
    });
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.hero}>
        <Image source={{ uri: photoUri }} style={styles.photo} resizeMode="cover" />
        <View style={styles.heroBody}>
          <Text style={typography.label}>{t('result.topMatch')}</Text>
          <Text style={styles.topBreed}>{breedName(top.breed)}</Text>
          <View style={styles.heroPills}>
            <Pill
              label={t(`guide.${top.animalType}`)}
              color={animalTypeColor(top.animalType)}
            />
            <Pill
              label={t('result.confidence', { percent: Math.round(top.confidence * 100) })}
              color={confidenceColor(top.confidence)}
              filled
            />
          </View>
        </View>
      </View>

      {uncertain && (
        <View style={styles.warning}>
          <Ionicons name="alert-circle" size={20} color={colors.warning} />
          <Text style={styles.warningText}>{t('result.lowConfidence')}</Text>
        </View>
      )}

      <Text style={[typography.label, styles.sectionHeading]}>{t('result.otherMatches')}</Text>
      <Text style={[typography.small, styles.sectionHint]}>{t('result.pickHint')}</Text>

      {candidates.map((candidate) => {
        const selected = candidate.breed === chosen;
        const tint = confidenceColor(candidate.confidence);
        return (
          <Pressable
            key={candidate.breed}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            style={[styles.candidate, selected && styles.candidateSelected]}
            onPress={() => setChosen(candidate.breed)}
          >
            <Image source={breedImage(candidate.breed)} style={styles.candidateThumb} />
            <View style={styles.candidateBody}>
              <View style={styles.candidateRow}>
                <Text style={[typography.body, selected && styles.candidateSelectedText]}
                      numberOfLines={1}>
                  {breedName(candidate.breed)}
                </Text>
                <Text style={[styles.candidatePercent, { color: tint }]}>
                  {Math.round(candidate.confidence * 100)}%
                </Text>
              </View>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, {
                  width: `${Math.max(2, candidate.confidence * 100)}%`,
                  backgroundColor: tint,
                }]} />
              </View>
            </View>
            <Ionicons
              name={selected ? 'radio-button-on' : 'radio-button-off'}
              size={22}
              color={selected ? colors.primary : colors.border}
            />
          </Pressable>
        );
      })}

      {!showAll && ranked.length > candidates.length && (
        <Button
          variant="quiet"
          label={t('result.showAll', { count: ranked.length })}
          onPress={() => setShowAll(true)}
        />
      )}

      {corrected && (
        <View style={styles.correction}>
          <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
          <Text style={styles.correctionText}>{t('result.correctionNote')}</Text>
        </View>
      )}

      <View style={styles.actions}>
        <Button variant="primary" icon="save-outline"
                label={t('result.register')} onPress={proceed} />
        <Button icon="camera-outline"
                label={t('result.retake')} onPress={() => navigation.goBack()} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.md, paddingBottom: spacing.xl },
  hero: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    overflow: 'hidden', marginBottom: spacing.md, ...shadow,
  },
  photo: { width: '100%', height: 200, backgroundColor: colors.surfaceMuted },
  heroBody: { padding: spacing.md, gap: spacing.xs },
  topBreed: { ...typography.display, marginBottom: spacing.xs },
  heroPills: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  warning: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm,
    backgroundColor: colors.warningSoft, borderRadius: radius.md,
    padding: spacing.md, marginBottom: spacing.md,
  },
  warningText: { ...typography.small, flex: 1, color: colors.text },
  sectionHeading: { marginBottom: spacing.xs },
  sectionHint: { marginBottom: spacing.sm },
  candidate: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.sm, marginBottom: spacing.sm,
  },
  candidateSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  candidateThumb: {
    width: 48, height: 48, borderRadius: radius.sm, backgroundColor: colors.surfaceMuted,
  },
  candidateBody: { flex: 1, gap: spacing.xs },
  candidateRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  candidateSelectedText: { fontWeight: '700' },
  candidatePercent: { fontSize: 14, fontWeight: '700' },
  barTrack: {
    height: 5, borderRadius: 3, backgroundColor: colors.surfaceMuted, overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 3 },
  correction: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.primarySoft, borderRadius: radius.md,
    padding: spacing.md, marginTop: spacing.xs,
  },
  correctionText: { ...typography.small, flex: 1, color: colors.text },
  actions: { gap: spacing.sm, marginTop: spacing.lg },
});
