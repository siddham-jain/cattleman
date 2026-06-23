/**
 * Offline-first local store.
 *
 * Field workers register animals in places with no usable network, so the phone
 * is the source of truth: a registration is committed locally and succeeds
 * whether or not the server is reachable. Sync is a background reconciliation,
 * never a precondition for saving.
 *
 * Every write also enqueues a sync job in the same transaction, so a crash
 * between "saved" and "queued" cannot strand a record that never syncs.
 */
import * as SQLite from 'expo-sqlite';

const DB_NAME = 'cattleman.db';

let dbPromise = null;

const MIGRATIONS = [
  // v1 — animals, their ranked predictions, and the outbound sync queue.
  `
  CREATE TABLE IF NOT EXISTS animals (
    id            TEXT PRIMARY KEY NOT NULL,
    tag_id        TEXT,
    breed         TEXT NOT NULL,
    animal_type   TEXT NOT NULL,
    confidence    REAL NOT NULL,
    photo_uri     TEXT,
    owner_name    TEXT,
    latitude      REAL,
    longitude     REAL,
    notes         TEXT,
    created_at    TEXT NOT NULL,
    updated_at    TEXT NOT NULL,
    synced_at     TEXT
  );

  CREATE TABLE IF NOT EXISTS predictions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    animal_id  TEXT NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
    breed      TEXT NOT NULL,
    confidence REAL NOT NULL,
    rank       INTEGER NOT NULL
  );

  -- Field corrections are training data. When a worker overrules the model we
  -- keep both labels so the disagreement can be reviewed and fed back.
  CREATE TABLE IF NOT EXISTS corrections (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    animal_id       TEXT NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
    predicted_breed TEXT NOT NULL,
    corrected_breed TEXT NOT NULL,
    created_at      TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sync_queue (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    entity       TEXT NOT NULL,
    entity_id    TEXT NOT NULL,
    operation    TEXT NOT NULL,
    attempts     INTEGER NOT NULL DEFAULT 0,
    last_error   TEXT,
    next_attempt TEXT,
    created_at   TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_animals_synced ON animals(synced_at);
  CREATE INDEX IF NOT EXISTS idx_predictions_animal ON predictions(animal_id);
  CREATE INDEX IF NOT EXISTS idx_queue_next ON sync_queue(next_attempt);
  `,
];

export async function getDatabase() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DB_NAME);
      await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
      await migrate(db);
      return db;
    })().catch((error) => {
      dbPromise = null;
      throw error;
    });
  }
  return dbPromise;
}

async function migrate(db) {
  const { user_version: current } = await db.getFirstAsync('PRAGMA user_version');
  for (let version = current; version < MIGRATIONS.length; version += 1) {
    await db.execAsync(MIGRATIONS[version]);
    await db.execAsync(`PRAGMA user_version = ${version + 1}`);
  }
}

function newId() {
  // Client-generated ids let a record exist and be referenced offline; the
  // server accepts the id rather than assigning one, which keeps sync idempotent.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Persist a registration and queue it for sync in one transaction.
 *
 * `ranked` is the model's full output; the chosen breed may differ from
 * ranked[0] when the worker overrules it, and that disagreement is recorded.
 */
export async function saveAnimal({ breed, animalType, confidence, ranked = [], photoUri,
                                   tagId, ownerName, latitude, longitude, notes }) {
  const db = await getDatabase();
  const id = newId();
  const now = new Date().toISOString();

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO animals (id, tag_id, breed, animal_type, confidence, photo_uri,
                            owner_name, latitude, longitude, notes, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, tagId ?? null, breed, animalType, confidence, photoUri ?? null,
       ownerName ?? null, latitude ?? null, longitude ?? null, notes ?? null, now, now],
    );

    for (let rank = 0; rank < ranked.length; rank += 1) {
      await db.runAsync(
        'INSERT INTO predictions (animal_id, breed, confidence, rank) VALUES (?,?,?,?)',
        [id, ranked[rank].breed, ranked[rank].confidence, rank],
      );
    }

    if (ranked.length && ranked[0].breed !== breed) {
      await db.runAsync(
        `INSERT INTO corrections (animal_id, predicted_breed, corrected_breed, created_at)
         VALUES (?,?,?,?)`,
        [id, ranked[0].breed, breed, now],
      );
    }

    await db.runAsync(
      `INSERT INTO sync_queue (entity, entity_id, operation, next_attempt, created_at)
       VALUES ('animal', ?, 'create', ?, ?)`,
      [id, now, now],
    );
  });

  return id;
}

export async function listAnimals({ limit = 50, offset = 0 } = {}) {
  const db = await getDatabase();
  return db.getAllAsync(
    `SELECT id, tag_id, breed, animal_type, confidence, photo_uri, owner_name,
            latitude, longitude, notes, created_at, synced_at
     FROM animals ORDER BY datetime(created_at) DESC LIMIT ? OFFSET ?`,
    [limit, offset],
  );
}

export async function getAnimal(id) {
  const db = await getDatabase();
  const animal = await db.getFirstAsync('SELECT * FROM animals WHERE id = ?', [id]);
  if (!animal) return null;
  animal.predictions = await db.getAllAsync(
    'SELECT breed, confidence, rank FROM predictions WHERE animal_id = ? ORDER BY rank',
    [id],
  );
  return animal;
}

export async function countPending() {
  const db = await getDatabase();
  const row = await db.getFirstAsync(
    'SELECT COUNT(*) AS pending FROM animals WHERE synced_at IS NULL',
  );
  return row?.pending ?? 0;
}

export async function breedDistribution() {
  const db = await getDatabase();
  return db.getAllAsync(
    `SELECT breed, animal_type, COUNT(*) AS total
     FROM animals GROUP BY breed, animal_type ORDER BY total DESC`,
  );
}

export async function markSynced(id) {
  const db = await getDatabase();
  await db.runAsync('UPDATE animals SET synced_at = ? WHERE id = ?',
                    [new Date().toISOString(), id]);
}
