import { useCallback, useState } from 'react';
import {
  FlatList, Pressable, RefreshControl, StyleSheet, Text, View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { breedDistribution, countPending, listAnimals } from '../db/database';
import { syncNow } from '../sync/sync';
import { i18n, t } from '../i18n';
import breedInfo from '../../assets/breeds.json';
import { colors, radius, spacing, TOUCH_TARGET, typography } from '../theme';

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

  function localName(breed) {
    const names = breedInfo[breed]?.names;
    return names?.[i18n.locale] ?? names?.en ?? breed;
  }

  return (
    <FlatList
      data={animals}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={syncing} onRefresh={runSync} />}
      ListHeaderComponent={
        <View>
          <View style={styles.statusRow}>
            <Text style={typography.small}>
              {pending > 0 ? t('registry.pending', { count: pending }) : t('registry.allSynced')}
            </Text>
            <Pressable style={styles.syncButton} onPress={runSync} disabled={syncing}>
              <Text style={styles.syncText}>
                {syncing ? t('registry.syncing') : t('registry.syncNow')}
              </Text>
            </Pressable>
          </View>

          {distribution.length > 0 && (
            <View style={styles.distribution}>
              <Text style={[typography.heading, styles.distributionTitle]}>
                {t('registry.distribution')}
              </Text>
              {distribution.map((row) => (
                <View key={`${row.breed}-${row.animal_type}`} style={styles.distributionRow}>
                  <View style={[styles.dot, {
                    backgroundColor: row.animal_type === 'buffalo' ? colors.buffalo : colors.cattle,
                  }]} />
                  <Text style={styles.distributionName}>{localName(row.breed)}</Text>
                  <Text style={typography.small}>{row.total}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      }
      ListEmptyComponent={<Text style={styles.empty}>{t('registry.empty')}</Text>}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={typography.heading}>{localName(item.breed)}</Text>
            <View style={[styles.badge, {
              backgroundColor: item.synced_at ? colors.success : colors.warning,
            }]}>
              <Text style={styles.badgeText}>
                {item.synced_at ? '✓' : '⟳'}
              </Text>
            </View>
          </View>
          {item.tag_id ? <Text style={typography.small}>{item.tag_id}</Text> : null}
          {item.owner_name ? <Text style={typography.small}>{item.owner_name}</Text> : null}
          <Text style={styles.timestamp}>
            {new Date(item.created_at).toLocaleString(i18n.locale)}
          </Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.md, paddingBottom: spacing.xl },
  statusRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  syncButton: {
    minHeight: TOUCH_TARGET, paddingHorizontal: spacing.md, justifyContent: 'center',
    borderRadius: radius.md, backgroundColor: colors.primary,
  },
  syncText: { color: colors.primaryText, fontWeight: '700', fontSize: 15 },
  distribution: {
    backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1,
    borderColor: colors.border, padding: spacing.md, marginBottom: spacing.md,
  },
  distributionTitle: { marginBottom: spacing.sm },
  distributionRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  distributionName: { ...typography.body, flex: 1 },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1,
    borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  badge: {
    width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { color: colors.primaryText, fontSize: 13, fontWeight: '700' },
  timestamp: { ...typography.small, marginTop: spacing.xs },
  empty: { ...typography.small, textAlign: 'center', marginTop: spacing.xl },
});
