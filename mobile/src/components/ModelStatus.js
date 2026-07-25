import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { t } from '../i18n';
import { useModelStatus } from '../inference/status';
import { colors, radius, spacing, typography } from '../theme';

// MB as the export script and model card count it, so this figure matches the
// 17.2 MB quoted everywhere else.
function megabytes(bytes) {
  return (bytes / 1e6).toFixed(1);
}

/**
 * Says what the model is doing while it is not yet usable.
 *
 * Only the download phase can show a real percentage, and only on web. The
 * others are short and honest about being indeterminate rather than faking a
 * bar that jumps to full.
 *
 * Loading off a phone's own bundle takes a few hundred milliseconds, so the
 * card waits a moment before appearing. Otherwise the common case is a flash of
 * a panel that shoves the buttons down and vanishes. A failure shows at once.
 */
const GRACE_MS = 600;

export default function ModelStatus({ onRetry }) {
  const { phase, progress, received, total, error } = useModelStatus();
  const [graced, setGraced] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setGraced(true), GRACE_MS);
    return () => clearTimeout(timer);
  }, []);

  if (phase === 'ready') return null;
  if (!graced && phase !== 'error') return null;

  if (phase === 'error') {
    return (
      <View style={[styles.card, styles.errorCard]}>
        <Ionicons name="alert-circle" size={20} color={colors.danger} />
        <View style={styles.body}>
          <Text style={styles.title}>{t('model.failed')}</Text>
          <Text style={typography.small} numberOfLines={3}>{error}</Text>
        </View>
        {onRetry && (
          <Pressable onPress={onRetry} style={styles.retry} accessibilityRole="button">
            <Text style={styles.retryText}>{t('common.retry')}</Text>
          </Pressable>
        )}
      </View>
    );
  }

  // Only a download with a known length can show a percentage. Without a
  // Content-Length the bytes so far are all there is to say.
  const measured = phase === 'downloading' && total > 0;
  const percent = Math.round((progress ?? 0) * 100);
  const title = measured
    ? t('model.downloading', { percent })
    : t(phase === 'downloading' ? 'model.downloadingUnknown' : `model.${phase}`);

  return (
    <View
      style={styles.card}
      accessibilityRole="progressbar"
      accessibilityValue={measured ? { min: 0, max: 100, now: percent } : undefined}
    >
      <ActivityIndicator color={colors.primary} />
      <View style={styles.body}>
        <Text style={styles.title}>{title}</Text>
        {measured ? (
          <>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${Math.max(2, percent)}%` }]} />
            </View>
            <Text style={typography.small}>
              {t('model.downloadedOf', { done: megabytes(received), total: megabytes(total) })}
            </Text>
          </>
        ) : (
          <Text style={typography.small}>{t('model.oneTime')}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.primarySoft, borderRadius: radius.md,
    padding: spacing.md,
  },
  errorCard: { backgroundColor: colors.dangerSoft },
  body: { flex: 1, gap: spacing.xs },
  title: { ...typography.body, fontWeight: '700' },
  track: {
    height: 6, borderRadius: 3, backgroundColor: colors.surface, overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 3, backgroundColor: colors.primary },
  retry: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  retryText: { ...typography.body, color: colors.danger, fontWeight: '700' },
});
