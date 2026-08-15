/**
 * Background sync of locally-registered animals.
 *
 * Design constraints from the field: connectivity is intermittent and often
 * arrives in short windows, so sync must resume from wherever it stopped and
 * must never lose a record. Nothing here blocks the UI — a failed sync is a
 * retry, not an error the worker has to resolve.
 *
 * Idempotency comes from client-generated ids: replaying a create for an id the
 * server already has is a no-op upsert, so a response lost in transit costs one
 * duplicate request rather than a duplicate animal.
 */
import { Platform } from 'react-native';
import * as Network from 'expo-network';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

import { getDatabase, markSynced } from '../db/database';

const SERVER_KEY = 'cattleman.serverUrl';
const POLL_INTERVAL_MS = 60_000;
const MAX_ATTEMPTS = 8;
const BATCH_SIZE = 20;

export async function getServerUrl() {
  const stored = await AsyncStorage.getItem(SERVER_KEY);
  if (stored) return stored;
  // The configured default is the emulator's alias for the host machine, which
  // means nothing in a browser — there the API is just on localhost.
  if (Platform.OS === 'web') return 'http://localhost:8000';
  return Constants.expoConfig?.extra?.apiBaseUrl || 'http://localhost:8000';
}

export async function setServerUrl(url) {
  await AsyncStorage.setItem(SERVER_KEY, url.replace(/\/+$/, ''));
}

/**
 * Exponential backoff, capped at roughly an hour.
 *
 * Uncapped doubling would push a record days into the future after a handful of
 * failures — long enough that a phone which regains signal would sit on unsent
 * data for no reason.
 */
function backoffMs(attempts) {
  return Math.min(2 ** attempts * 1000, 60 * 60 * 1000);
}

async function isOnline() {
  try {
    const state = await Network.getNetworkStateAsync();
    return Boolean(state.isConnected && state.isInternetReachable !== false);
  } catch {
    return false;
  }
}

async function pendingJobs(db, limit) {
  const now = new Date().toISOString();
  return db.getAllAsync(
    `SELECT * FROM sync_queue
     WHERE attempts < ? AND (next_attempt IS NULL OR next_attempt <= ?)
     ORDER BY datetime(created_at) LIMIT ?`,
    [MAX_ATTEMPTS, now, limit],
  );
}

async function buildPayload(db, animalId) {
  const animal = await db.getFirstAsync('SELECT * FROM animals WHERE id = ?', [animalId]);
  if (!animal) return null;
  const predictions = await db.getAllAsync(
    'SELECT breed, confidence, rank FROM predictions WHERE animal_id = ? ORDER BY rank',
    [animalId],
  );
  const corrections = await db.getAllAsync(
    'SELECT predicted_breed, corrected_breed FROM corrections WHERE animal_id = ?',
    [animalId],
  );
  return {
    id: animal.id,
    tag_id: animal.tag_id,
    breed: animal.breed,
    animal_type: animal.animal_type,
    confidence: animal.confidence,
    owner_name: animal.owner_name,
    latitude: animal.latitude,
    longitude: animal.longitude,
    notes: animal.notes,
    created_at: animal.created_at,
    predictions: predictions.map((p) => ({
      breed: p.breed, confidence: p.confidence, rank: p.rank,
    })),
    corrections: corrections.map((c) => ({
      predicted_breed: c.predicted_breed, corrected_breed: c.corrected_breed,
    })),
  };
}

async function recordFailure(db, job, message) {
  const attempts = job.attempts + 1;
  const nextAttempt = new Date(Date.now() + backoffMs(attempts)).toISOString();
  await db.runAsync(
    'UPDATE sync_queue SET attempts = ?, last_error = ?, next_attempt = ? WHERE id = ?',
    [attempts, String(message).slice(0, 300), nextAttempt, job.id],
  );
}

/**
 * Push everything currently due. Returns counts for the UI.
 */
export async function syncNow() {
  if (!(await isOnline())) {
    return { skipped: true, synced: 0, failed: 0 };
  }

  const db = await getDatabase();
  const baseUrl = await getServerUrl();
  const jobs = await pendingJobs(db, BATCH_SIZE);

  let synced = 0;
  let failed = 0;

  for (const job of jobs) {
    const payload = await buildPayload(db, job.entity_id);
    if (!payload) {
      // The animal was deleted locally; the job has nothing left to do.
      await db.runAsync('DELETE FROM sync_queue WHERE id = ?', [job.id]);
      continue;
    }

    try {
      const response = await fetch(`${baseUrl}/api/animals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        await db.runAsync('DELETE FROM sync_queue WHERE id = ?', [job.id]);
        await markSynced(job.entity_id);
        synced += 1;
      } else if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        // The server rejected the record itself; retrying cannot fix it, so stop
        // burning attempts and leave it visible for review.
        await db.runAsync(
          'UPDATE sync_queue SET attempts = ?, last_error = ? WHERE id = ?',
          [MAX_ATTEMPTS, `rejected: HTTP ${response.status}`, job.id],
        );
        failed += 1;
      } else {
        await recordFailure(db, job, `HTTP ${response.status}`);
        failed += 1;
      }
    } catch (error) {
      await recordFailure(db, job, error?.message ?? error);
      failed += 1;
    }
  }

  return { skipped: false, synced, failed };
}

/**
 * Poll while the app is running. Returns a stop function.
 */
export function startSyncLoop(intervalMs = POLL_INTERVAL_MS) {
  let stopped = false;

  const tick = async () => {
    if (stopped) return;
    try {
      await syncNow();
    } catch {
      // Never let a sync failure surface as an unhandled rejection; the queue
      // already recorded the error and will retry.
    }
  };

  tick();
  const handle = setInterval(tick, intervalMs);
  return () => {
    stopped = true;
    clearInterval(handle);
  };
}

export async function queueStatus() {
  const db = await getDatabase();
  const row = await db.getFirstAsync(
    `SELECT COUNT(*) AS queued,
            SUM(CASE WHEN attempts >= ? THEN 1 ELSE 0 END) AS stuck
     FROM sync_queue`,
    [MAX_ATTEMPTS],
  );
  return { queued: row?.queued ?? 0, stuck: row?.stuck ?? 0 };
}
