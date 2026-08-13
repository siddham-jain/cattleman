/**
 * expo-sqlite's async API, backed by sql.js (web only).
 *
 * expo-sqlite has no web implementation in SDK 52. Rather than reimplement the
 * store, this runs the same SQLite build compiled to WASM, so every migration,
 * query, and transaction in src/db/database.js and src/sync/sync.js executes
 * unchanged — including the write-plus-enqueue transaction, which is the part
 * worth demonstrating.
 *
 * sql.js holds the database in memory, so it is exported to IndexedDB after each
 * write. That keeps registrations across a page reload, which is what makes the
 * offline queue visible in a browser.
 */
const SQL_DIR = '/sql/';
const IDB_NAME = 'cattleman-sqlite';
const IDB_STORE = 'databases';

let enginePromise = null;

function loadEngine() {
  if (!enginePromise) {
    enginePromise = new Promise((resolve, reject) => {
      if (window.initSqlJs) {
        resolve(window.initSqlJs);
        return;
      }
      const script = document.createElement('script');
      script.src = `${SQL_DIR}sql-wasm.js`;
      script.onload = () => resolve(window.initSqlJs);
      script.onerror = () => reject(new Error(
        'sql.js failed to load. Run `npm run web:assets` to populate mobile/public.',
      ));
      document.head.appendChild(script);
    }).then((initSqlJs) => initSqlJs({ locateFile: (file) => `${SQL_DIR}${file}` }))
      .catch((error) => {
        enginePromise = null;
        throw error;
      });
  }
  return enginePromise;
}

function openStore() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(IDB_STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readSnapshot(name) {
  const store = await openStore();
  return new Promise((resolve, reject) => {
    const request = store.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).get(name);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  });
}

async function writeSnapshot(name, bytes) {
  const store = await openStore();
  return new Promise((resolve, reject) => {
    const transaction = store.transaction(IDB_STORE, 'readwrite');
    transaction.objectStore(IDB_STORE).put(bytes, name);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

function readRows(db, sql, params) {
  const statement = db.prepare(sql);
  try {
    if (params?.length) statement.bind(params);
    const rows = [];
    while (statement.step()) rows.push(statement.getAsObject());
    return rows;
  } finally {
    statement.free();
  }
}

/** expo-sqlite accepts both `run(sql, [a, b])` and `run(sql, a, b)`. */
function normaliseParams(params) {
  if (params.length === 1 && Array.isArray(params[0])) return params[0];
  return params;
}

export async function openDatabaseAsync(name) {
  const SQL = await loadEngine();
  const snapshot = await readSnapshot(name);
  const db = snapshot ? new SQL.Database(snapshot) : new SQL.Database();

  let persisting = null;
  let depth = 0;

  // Exporting mid-transaction would snapshot a half-written state, so a persist
  // requested inside one is deferred until it commits.
  const persist = () => {
    if (depth > 0) return Promise.resolve();
    persisting = (persisting ?? Promise.resolve())
      .then(() => writeSnapshot(name, db.export()))
      .catch(() => {});
    return persisting;
  };

  return {
    async execAsync(sql) {
      db.exec(sql);
      await persist();
    },

    async runAsync(sql, ...params) {
      db.run(sql, normaliseParams(params));
      await persist();
      const [row] = readRows(db, 'SELECT last_insert_rowid() AS id', []);
      return { lastInsertRowId: row?.id ?? 0, changes: db.getRowsModified() };
    },

    async getAllAsync(sql, ...params) {
      return readRows(db, sql, normaliseParams(params));
    },

    async getFirstAsync(sql, ...params) {
      return readRows(db, sql, normaliseParams(params))[0] ?? null;
    },

    async withTransactionAsync(task) {
      db.exec('BEGIN');
      depth += 1;
      try {
        await task();
        depth -= 1;
        db.exec('COMMIT');
      } catch (error) {
        depth -= 1;
        db.exec('ROLLBACK');
        throw error;
      }
      await persist();
    },

    async closeAsync() {
      await persist();
      db.close();
    },
  };
}
