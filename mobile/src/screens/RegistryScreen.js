import { useCallback, useState } from 'react';
import {
  FlatList, Image, RefreshControl, StyleSheet, Text, View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { breedDistribution, countPending, listAnimals } from '../db/database';
import { syncNow } from '../sync/sync';
import { i18n, t } from '../i18n';
import { breedImage, breedName } from '../breeds';
import Button from '../components/Button';
import Pill from '../components/Pill';
import {
  animalTypeColor, colors, radius, shadow, spacing, typography,
} from '../theme';

export default function RegistryScreen() {
  const [animals, setAnimals] = useState([]);
  const [pending, setPending] = useState(0);
  const [distribution, setDistribution] = useState([]);
  const [syncing, setSyncing] = useState(false);

  const refresh = useCallback(async () => {
    const [rows, pendingCount, dist] = await Promise.all([
      listAnimals(), countPending(), breedDistribution(),
    ]);
    setAnimals(rows);
    setPending(pendingCount);
    setDistribution(dist);
  }, []);

  // Re-read on focus so a registration made moments ago is visible immediately.
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  async function runSync() {
    setSyncing(true);
    try {
      await syncNow();
      await refresh();
    } finally {
      setSyncing(false);
    }
  }

  const busiest = distribution[0]?.total ?? 1;

  return (
    <FlatList
      data={animals}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={syncing} onRefresh={runSync} />}
      ListHeaderComponent={
        <View>
          <View style={styles.statusCard}>
            <Ionicons
              name={pending > 0 ? 'cloud-upload-outline' : 'cloud-done-outline'}
              size={22}
              color={pending > 0 ? colors.warning : colors.primary}
            />
            <View style={styles.statusText}>
              <Text style={typography.heading}>
                {pending > 0 ? t('registry.pending', { count: pending }) : t('registry.allSynced')}
              </Text>
              <Text style={typography.small}>{t('registry.total', { count: animals.length })}</Text>
            </View>
            <Button
              variant={pending > 0 ? 'primary' : 'secondary'}
              label={syncing ? t('registry.syncing') : t('registry.syncNow')}
              busy={syncing}
              onPress={runSync}
            />
          </View>

          {distribution.length > 0 && (
            <View style={styles.distribution}>
              <Text style={typography.label}>{t('registry.distribution')}</Text>
              {distribution.map((row) => (
                <View key={`${row.breed}-${row.animal_type}`} style={styles.distributionRow}>
                  <Text style={styles.distributionName} numberOfLines={1}>
                    {breedName(row.breed)}
                  </Text>
                  <View style={styles.distributionTrack}>
                    <View style={[styles.distributionFill, {
                      width: `${Math.max(6, (row.total / busiest) * 100)}%`,
                      backgroundColor: animalTypeColor(row.animal_type),
                    }]} />
                  </View>
                  <Text style={styles.distributionCount}>{row.total}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Ionicons name="albums-outline" size={40} color={colors.textMuted} />
          <Text style={typography.heading}>{t('registry.empty')}</Text>
          <Text style={[typography.small, styles.emptyHint]}>{t('registry.emptyHint')}</Text>
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.card}>
          <Image
            source={item.photo_uri ? { uri: item.photo_uri } : breedImage(item.breed)}
            style={styles.thumb}
            resizeMode="cover"
          />
          <View style={styles.cardBody}>
            <Text style={typography.heading} numberOfLines={1}>{breedName(item.breed)}</Text>
            <Text style={typography.small} numberOfLines={1}>
              {[item.tag_id, item.owner_name].filter(Boolean).join(' · ') || t('registry.noTag')}
            </Text>
            <Text style={typography.small}>
              {new Date(item.created_at).toLocaleDateString(i18n.locale, {
                day: 'numeric', month: 'short', year: 'numeric',
              })}
            </Text>
          </View>
          <Pill
            label={item.synced_at ? t('registry.synced') : t('registry.queued')}
            color={item.synced_at ? colors.primary : colors.warning}
            icon={item.synced_at ? 'checkmark' : 'time-outline'}
          />
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.md, paddingBottom: spacing.xl },
  statusCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.md, marginBottom: spacing.md, ...shadow,
  },
  statusText: { flex: 1, gap: 2 },
  distribution: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.md, marginBottom: spacing.md, gap: spacing.sm, ...shadow,
  },
  distributionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  distributionName: { ...typography.small, color: colors.text, width: 96 },
  distributionTrack: {
    flex: 1, height: 8, borderRadius: 4,
    backgroundColor: colors.surfaceMuted, overflow: 'hidden',
  },
  distributionFill: { height: '100%', borderRadius: 4 },
  distributionCount: { ...typography.small, color: colors.text, fontWeight: '700', minWidth: 20,
    textAlign: 'right' },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.sm, marginBottom: spacing.sm, ...shadow,
  },
  thumb: {
    width: 60, height: 60, borderRadius: radius.md, backgroundColor: colors.surfaceMuted,
  },
  cardBody: { flex: 1, gap: 2 },
  empty: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.xl },
  emptyHint: { textAlign: 'center', maxWidth: 260 },
});
