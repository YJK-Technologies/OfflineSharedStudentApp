/**
 * Electron Local SQLite Database Layer
 * Primary: better-sqlite3 (native C++ SQLite engine)
 * Fallback: File-backed persistent JSON SQLite engine in userData directory
 * 
 * Auto-detects NODE_MODULE_VERSION mismatches and provides seamless fallback
 * so the application NEVER crashes on native module ABI discrepancies.
 */

const path = require('path');
const fs = require('fs');
const { app } = require('electron');

let db = null;
let statements = null;
let isNativeSqlite = false;
let fallbackFileStore = null;

function getUserDataDir() {
  const userDataPath = app.getPath('userData');
  if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true });
  }
  return userDataPath;
}

function getDatabasePath() {
  return path.join(getUserDataDir(), 'student_manager_local.db');
}

function getFallbackJsonPath() {
  return path.join(getUserDataDir(), 'student_manager_local.json');
}

// Read fallback JSON file
function readJsonStore() {
  const filePath = getFallbackJsonPath();
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('[Fallback DB] Read error:', e);
  }
  return { students: [], meta: { last_sync_cursor: '1970-01-01T00:00:00.000Z' } };
}

// Write fallback JSON file safely
function writeJsonStore(data) {
  const filePath = getFallbackJsonPath();
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error('[Fallback DB] Write error:', e);
  }
}

function initLocalDatabase() {
  if (db || fallbackFileStore) return true;

  try {
    const Database = require('better-sqlite3');
    const dbPath = getDatabasePath();
    console.log(`[Electron SQLite] Loading better-sqlite3 at: ${dbPath}`);

    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');

    db.exec(`
      CREATE TABLE IF NOT EXISTS local_students (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        mobile TEXT NOT NULL,
        email TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        is_deleted INTEGER NOT NULL DEFAULT 0,
        sync_status TEXT NOT NULL DEFAULT 'synced',
        version INTEGER NOT NULL DEFAULT 1,
        server_updated_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_local_sync_status ON local_students (sync_status);
      CREATE INDEX IF NOT EXISTS idx_local_is_deleted ON local_students (is_deleted);
      CREATE TABLE IF NOT EXISTS sync_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    `);

    statements = {
      getAllActive: db.prepare(`
        SELECT id, name, mobile, email, created_at, updated_at, is_deleted, sync_status, version, server_updated_at
        FROM local_students
        WHERE is_deleted = 0
        ORDER BY updated_at DESC
      `),
      getAll: db.prepare(`
        SELECT id, name, mobile, email, created_at, updated_at, is_deleted, sync_status, version, server_updated_at
        FROM local_students
        ORDER BY updated_at DESC
      `),
      getById: db.prepare(`SELECT * FROM local_students WHERE id = ?`),
      insert: db.prepare(`
        INSERT INTO local_students (id, name, mobile, email, created_at, updated_at, is_deleted, sync_status, version, server_updated_at)
        VALUES (@id, @name, @mobile, @email, @created_at, @updated_at, @is_deleted, @sync_status, @version, @server_updated_at)
      `),
      update: db.prepare(`
        UPDATE local_students
        SET name = @name, mobile = @mobile, email = @email, updated_at = @updated_at, is_deleted = @is_deleted, sync_status = @sync_status, version = @version
        WHERE id = @id
      `),
      softDelete: db.prepare(`
        UPDATE local_students
        SET is_deleted = 1, updated_at = @updated_at, sync_status = 'pending_delete', version = version + 1
        WHERE id = @id
      `),
      getPendingSync: db.prepare(`
        SELECT id, name, mobile, email, created_at, updated_at, is_deleted, sync_status, version
        FROM local_students
        WHERE sync_status IN ('pending_insert', 'pending_update', 'pending_delete')
      `),
      markSynced: db.prepare(`
        UPDATE local_students
        SET sync_status = 'synced', server_updated_at = @server_updated_at
        WHERE id = @id
      `),
      upsertFromPull: db.prepare(`
        INSERT INTO local_students (id, name, mobile, email, created_at, updated_at, is_deleted, sync_status, version, server_updated_at)
        VALUES (@id, @name, @mobile, @email, @created_at, @updated_at, @is_deleted, 'synced', @version, @server_updated_at)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name, mobile = excluded.mobile, email = excluded.email,
          created_at = excluded.created_at, updated_at = excluded.updated_at, is_deleted = excluded.is_deleted,
          sync_status = 'synced', version = excluded.version, server_updated_at = excluded.server_updated_at
        WHERE local_students.sync_status = 'synced' OR excluded.version > local_students.version
      `),
      getMeta: db.prepare(`SELECT value FROM sync_meta WHERE key = ?`),
      setMeta: db.prepare(`INSERT INTO sync_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`)
    };

    isNativeSqlite = true;
    console.log('[Electron SQLite] Native better-sqlite3 initialized successfully.');
    return true;
  } catch (err) {
    console.warn('\n================================================================================');
    console.warn('⚠️ [Electron Native Module ABI Warning]:', err.message);
    console.warn('👉 To recompile better-sqlite3 for Electron, run in frontend/:');
    console.warn('   npm run rebuild:electron');
    console.warn('   (or: npx electron-builder install-app-deps)');
    console.warn('✅ Running in persistent local JSON storage mode so the app continues working!');
    console.warn('================================================================================\n');

    isNativeSqlite = false;
    fallbackFileStore = readJsonStore();
    return true;
  }
}

module.exports = {
  initLocalDatabase,

  getAllStudents: (includeDeleted = false) => {
    initLocalDatabase();
    if (isNativeSqlite && statements) {
      return includeDeleted ? statements.getAll.all() : statements.getAllActive.all();
    }
    const store = readJsonStore();
    return includeDeleted 
      ? store.students.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
      : store.students.filter(s => !s.is_deleted).sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
  },

  getStudentById: (id) => {
    initLocalDatabase();
    if (isNativeSqlite && statements) {
      return statements.getById.get(id);
    }
    const store = readJsonStore();
    return store.students.find(s => s.id === id) || null;
  },

  insertStudent: (student) => {
    initLocalDatabase();
    const now = new Date().toISOString();
    const record = {
      id: student.id,
      name: student.name,
      mobile: student.mobile,
      email: student.email,
      created_at: student.created_at || now,
      updated_at: student.updated_at || now,
      is_deleted: 0,
      sync_status: 'pending_insert',
      version: 1,
      server_updated_at: null
    };

    if (isNativeSqlite && statements) {
      statements.insert.run(record);
      return record;
    }

    const store = readJsonStore();
    store.students.unshift(record);
    writeJsonStore(store);
    return record;
  },

  updateStudent: (student) => {
    initLocalDatabase();
    const now = new Date().toISOString();

    if (isNativeSqlite && statements) {
      const existing = statements.getById.get(student.id);
      if (!existing) throw new Error('Student not found in local SQLite');
      const newSyncStatus = existing.sync_status === 'pending_insert' ? 'pending_insert' : 'pending_update';
      const record = {
        id: student.id,
        name: student.name,
        mobile: student.mobile,
        email: student.email,
        updated_at: now,
        is_deleted: student.is_deleted !== undefined ? student.is_deleted : existing.is_deleted,
        sync_status: newSyncStatus,
        version: (existing.version || 1) + 1
      };
      statements.update.run(record);
      return record;
    }

    const store = readJsonStore();
    const idx = store.students.findIndex(s => s.id === student.id);
    if (idx === -1) throw new Error('Student not found in local storage');
    const existing = store.students[idx];
    const newSyncStatus = existing.sync_status === 'pending_insert' ? 'pending_insert' : 'pending_update';
    const updated = {
      ...existing,
      name: student.name !== undefined ? student.name : existing.name,
      mobile: student.mobile !== undefined ? student.mobile : existing.mobile,
      email: student.email !== undefined ? student.email : existing.email,
      updated_at: now,
      is_deleted: student.is_deleted !== undefined ? student.is_deleted : existing.is_deleted,
      sync_status: newSyncStatus,
      version: (existing.version || 1) + 1
    };
    store.students[idx] = updated;
    writeJsonStore(store);
    return updated;
  },

  deleteStudent: (id) => {
    initLocalDatabase();
    const now = new Date().toISOString();

    if (isNativeSqlite && statements) {
      statements.softDelete.run({ id, updated_at: now });
      return { id, is_deleted: 1 };
    }

    const store = readJsonStore();
    const idx = store.students.findIndex(s => s.id === id);
    if (idx !== -1) {
      store.students[idx].is_deleted = 1;
      store.students[idx].updated_at = now;
      store.students[idx].sync_status = 'pending_delete';
      store.students[idx].version = (store.students[idx].version || 1) + 1;
      writeJsonStore(store);
    }
    return { id, is_deleted: 1 };
  },

  getPendingSyncRecords: () => {
    initLocalDatabase();
    if (isNativeSqlite && statements) {
      return statements.getPendingSync.all();
    }
    const store = readJsonStore();
    return store.students.filter(s => ['pending_insert', 'pending_update', 'pending_delete'].includes(s.sync_status));
  },

  markRecordsAsSynced: (ids, serverTimestamps = {}) => {
    initLocalDatabase();
    if (isNativeSqlite && statements) {
      const markTx = db.transaction((idList) => {
        for (const id of idList) {
          statements.markSynced.run({
            id,
            server_updated_at: serverTimestamps[id] || new Date().toISOString()
          });
        }
      });
      markTx(ids);
      return true;
    }

    const store = readJsonStore();
    for (const s of store.students) {
      if (ids.includes(s.id)) {
        s.sync_status = 'synced';
        s.server_updated_at = serverTimestamps[s.id] || new Date().toISOString();
      }
    }
    writeJsonStore(store);
    return true;
  },

  applyPullChanges: (serverRecords, newCursor) => {
    initLocalDatabase();
    if (isNativeSqlite && statements) {
      const applyTx = db.transaction((records) => {
        for (const r of records) {
          statements.upsertFromPull.run(r);
        }
        if (newCursor) {
          statements.setMeta.run('last_sync_cursor', newCursor);
        }
      });
      applyTx(serverRecords);
      return true;
    }

    const store = readJsonStore();
    for (const r of serverRecords) {
      const idx = store.students.findIndex(s => s.id === r.id);
      if (idx === -1) {
        store.students.push({ ...r, sync_status: 'synced' });
      } else {
        if (store.students[idx].sync_status === 'synced' || r.version > store.students[idx].version) {
          store.students[idx] = { ...r, sync_status: 'synced' };
        }
      }
    }
    if (newCursor) {
      store.meta = store.meta || {};
      store.meta.last_sync_cursor = newCursor;
    }
    writeJsonStore(store);
    return true;
  },

  getLastSyncCursor: () => {
    initLocalDatabase();
    if (isNativeSqlite && statements) {
      const row = statements.getMeta.get('last_sync_cursor');
      return row ? row.value : '1970-01-01T00:00:00.000Z';
    }
    const store = readJsonStore();
    return (store.meta && store.meta.last_sync_cursor) || '1970-01-01T00:00:00.000Z';
  },

  setLastSyncCursor: (cursor) => {
    initLocalDatabase();
    if (isNativeSqlite && statements) {
      statements.setMeta.run('last_sync_cursor', cursor);
      return true;
    }
    const store = readJsonStore();
    store.meta = store.meta || {};
    store.meta.last_sync_cursor = cursor;
    writeJsonStore(store);
    return true;
  }
};
