import { useState } from 'react';
import {
  Image, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';

import { i18n, t } from '../i18n';
import breedInfo from '../../assets/breeds.json';
import {
  colors, confidenceColor, LOW_CONFIDENCE, radius, spacing, TOUCH_TARGET, typography,
} from '../theme';

/**
 * Shows the ranked candidates rather than a single verdict.
 *
 * The model is right about two times in three, so presenting one breed as "the"
 * answer would overstate what it knows. A worker who can see the runners-up and
 * override them ends up with better data than one who is handed a guess.
 */
export default function ResultScreen({ route, navigation }) {
  const { photoUri, ranked } = route.params;
  const [chosen, setChosen] = useState(ranked[0].breed);

  const top = ranked[0];
  const uncertain = top.confidence < LOW_CONFIDENCE;
  const corrected = chosen !== top.breed;

  // Breed names are proper nouns, so they live in breeds.json beside the rest of
  // the reference data rather than in the UI string catalogues.
  function localName(breed) {
    const names = breedInfo[breed]?.names;
    return names?.[i18n.locale] ?? names?.en ?? breed;
  }

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
      <Image source={{ uri: photoUri }} style={styles.photo} resizeMode="cover" />

      <Text style={typography.small}>{t('result.topMatch')}</Text>
      <Text style={styles.topBreed}>{localName(top.breed)}</Text>
      <Text style={[styles.confidence, { color: confidenceColor(top.confidence) }]}>
        {t('result.confidence', { percent: Math.round(top.confidence * 100) })}
      </Text>

      {uncertain && (
        <View style={styles.warning}>
          <Text style={styles.warningText}>{t('result.lowConfidence')}</Text>
        </View>
      )}

      <Text style={[typography.heading, styles.sectionHeading]}>{t('result.otherMatches')}</Text>
      {ranked.map((candidate) => {
        const selected = candidate.breed === chosen;
        return (
          <Pressable
            key={candidate.breed}
            style={[styles.candidate, selected && styles.candidateSelected]}
            onPress={() => setChosen(candidate.breed)}
          >
            <View style={styles.candidateRow}>
              <Text style={[typography.body, selected && styles.candidateSelectedText]}>
                {localName(candidate.breed)}
              </Text>
              <Text style={[typography.small, { color: confidenceColor(candidate.confidence) }]}>
                {Math.round(candidate.confidence * 100)}%
              </Text>
            </View>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, {
                width: `${Math.max(2, candidate.confidence * 100)}%`,
                backgroundColor: confidenceColor(candidate.confidence),
              }]} />
            </View>
          </Pressable>
        );
      })}

      {corrected && <Text style={styles.correction}>{t('result.correctionNote')}</Text>}

      <Pressable style={[styles.button, styles.primaryButton]} onPress={proceed}>
        <Text style={styles.primaryButtonText}>{t('result.register')}</Text>
      </Pressable>
      <Pressable style={styles.button} onPress={() => navigation.goBack()}>
        <Text style={styles.buttonText}>{t('result.retake')}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.md, gap: spacing.xs, paddingBottom: spacing.xl },
  photo: { width: '100%', height: 200, borderRadius: radius.md, marginBottom: spacing.md },
  topBreed: { fontSize: 30, fontWeight: '700', color: colors.text },
  confidence: { fontSize: 16, fontWeight: '600', marginBottom: spacing.sm },
  warning: {
    backgroundColor: '#fdf6e3', borderColor: colors.warning, borderWidth: 1,
    borderRadius: radius.sm, padding: spacing.sm, marginBottom: spacing.sm,
  },
  warningText: { color: '#7a5c07', fontSize: 15 },
  sectionHeading: { marginTop: spacing.md, marginBottom: spacing.sm },
  candidate: {
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
    borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.sm,
    minHeight: TOUCH_TARGET, justifyContent: 'center',
  },
  candidateSelected: { borderColor: colors.primary, borderWidth: 2 },
  candidateSelectedText: { fontWeight: '700' },
  candidateRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },
  barTrack: { height: 6, borderRadius: 3, backgroundColor: colors.border, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },
  correction: {
    ...typography.small, color: colors.primary, marginTop: spacing.xs, marginBottom: spacing.sm,
  },
  button: {
    minHeight: TOUCH_TARGET, borderRadius: radius.md, borderWidth: 1,
    borderColor: colors.border, backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm,
  },
  primaryButton: { backgroundColor: colors.primary, borderColor: colors.primary },
  buttonText: { ...typography.body, fontWeight: '600' },
  primaryButtonText: { color: colors.primaryText, fontSize: 16, fontWeight: '700' },
});
