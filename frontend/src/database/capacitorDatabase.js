/**
 * Capacitor Android SQLite Database Adapter
 * Uses @capacitor-community/sqlite plugin on Android mobile devices
 */

import { Capacitor } from '@capacitor/core';

let sqliteConnection = null;
let dbInstance = null;

const DB_NAME = 'students_local_db';

export const capacitorDatabase = {
  name: 'Capacitor Android SQLite (@capacitor-community/sqlite)',

  async initDatabase() {
    try {
      const { CapacitorSQLite, SQLiteConnection } = await import('@capacitor-community/sqlite');
      sqliteConnection = new SQLiteConnection(CapacitorSQLite);

      // Check if connection already exists
      const isConn = await sqliteConnection.isConnection(DB_NAME, false);
      if (isConn.result) {
        dbInstance = await sqliteConnection.retrieveConnection(DB_NAME, false);
      } else {
        dbInstance = await sqliteConnection.createConnection(
          DB_NAME,
          false,
          'no-encryption',
          1,
          false
        );
      }

      await dbInstance.open();

      // Create Local Students Table and Sync Meta Table
      const schema = `
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

        CREATE INDEX IF NOT EXISTS idx_local_sync_status 
        ON local_students (sync_status);

        CREATE TABLE IF NOT EXISTS sync_meta (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );
      `;

      await dbInstance.execute(schema);
      console.log('[Android SQLite] Local database initialized successfully');
      return true;
    } catch (err) {
      console.error('[Android SQLite Init Error]:', err);
      throw err;
    }
  },

  async getAllStudents(includeDeleted = false) {
    if (!dbInstance) await this.initDatabase();
    const query = includeDeleted
      ? 'SELECT * FROM local_students ORDER BY updated_at DESC;'
      : 'SELECT * FROM local_students WHERE is_deleted = 0 ORDER BY updated_at DESC;';
    const res = await dbInstance.query(query);
    return res.values || [];
  },

  async getStudentById(id) {
    if (!dbInstance) await this.initDatabase();
    const res = await dbInstance.query('SELECT * FROM local_students WHERE id = ?;', [id]);
    return res.values && res.values.length > 0 ? res.values[0] : null;
  },

  async insertStudent(student) {
    if (!dbInstance) await this.initDatabase();
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

    const sql = `
      INSERT INTO local_students (id, name, mobile, email, created_at, updated_at, is_deleted, sync_status, version, server_updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `;

    await dbInstance.run(sql, [
      record.id,
      record.name,
      record.mobile,
      record.email,
      record.created_at,
      record.updated_at,
      record.is_deleted,
      record.sync_status,
      record.version,
      record.server_updated_at
    ]);

    return record;
  },

  async updateStudent(student) {
    if (!dbInstance) await this.initDatabase();
    const existing = await this.getStudentById(student.id);
    if (!existing) throw new Error('Student not found in Android SQLite');

    const now = new Date().toISOString();
    const newSyncStatus = existing.sync_status === 'pending_insert' ? 'pending_insert' : 'pending_update';
    const nextVersion = (existing.version || 1) + 1;

    const sql = `
      UPDATE local_students
      SET name = ?,
          mobile = ?,
          email = ?,
          updated_at = ?,
          is_deleted = ?,
          sync_status = ?,
          version = ?
      WHERE id = ?;
    `;

    await dbInstance.run(sql, [
      student.name,
      student.mobile,
      student.email,
      now,
      student.is_deleted !== undefined ? student.is_deleted : existing.is_deleted,
      newSyncStatus,
      nextVersion,
      student.id
    ]);

    return { ...existing, ...student, updated_at: now, sync_status: newSyncStatus, version: nextVersion };
  },

  async deleteStudent(id) {
    if (!dbInstance) await this.initDatabase();
    const now = new Date().toISOString();
    const sql = `
      UPDATE local_students
      SET is_deleted = 1,
          updated_at = ?,
          sync_status = 'pending_delete',
          version = version + 1
      WHERE id = ?;
    `;
    await dbInstance.run(sql, [now, id]);
    return { id, is_deleted: 1 };
  },

  async getPendingSyncRecords() {
    if (!dbInstance) await this.initDatabase();
    const sql = `
      SELECT id, name, mobile, email, created_at, updated_at, is_deleted, sync_status, version
      FROM local_students
      WHERE sync_status IN ('pending_insert', 'pending_update', 'pending_delete');
    `;
    const res = await dbInstance.query(sql);
    return res.values || [];
  },

  async markRecordsAsSynced(ids, serverTimestamps = {}) {
    if (!dbInstance) await this.initDatabase();
    if (!ids || ids.length === 0) return true;

    for (const id of ids) {
      const ts = serverTimestamps[id] || new Date().toISOString();
      await dbInstance.run(
        'UPDATE local_students SET sync_status = ?, server_updated_at = ? WHERE id = ?;',
        ['synced', ts, id]
      );
    }
    return true;
  },

  async applyPullChanges(records, newCursor) {
    if (!dbInstance) await this.initDatabase();
    if (!records || records.length === 0) {
      if (newCursor) {
        await this.setLastSyncCursor(newCursor);
      }
      return true;
    }

    for (const r of records) {
      // Upsert into local_students
      const existing = await this.getStudentById(r.id);
      if (!existing) {
        const insertSql = `
          INSERT INTO local_students (id, name, mobile, email, created_at, updated_at, is_deleted, sync_status, version, server_updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'synced', ?, ?);
        `;
        await dbInstance.run(insertSql, [
          r.id, r.name, r.mobile, r.email, r.created_at, r.updated_at, r.is_deleted, r.version, r.server_updated_at
        ]);
      } else {
        // Only update if existing is synced or server version is greater
        if (existing.sync_status === 'synced' || r.version > existing.version) {
          const updateSql = `
            UPDATE local_students
            SET name = ?,
                mobile = ?,
                email = ?,
                created_at = ?,
                updated_at = ?,
                is_deleted = ?,
                sync_status = 'synced',
                version = ?,
                server_updated_at = ?
            WHERE id = ?;
          `;
          await dbInstance.run(updateSql, [
            r.name, r.mobile, r.email, r.created_at, r.updated_at, r.is_deleted, r.version, r.server_updated_at, r.id
          ]);
        }
      }
    }

    if (newCursor) {
      await this.setLastSyncCursor(newCursor);
    }
    return true;
  },

  async getLastSyncCursor() {
    if (!dbInstance) await this.initDatabase();
    const res = await dbInstance.query('SELECT value FROM sync_meta WHERE key = ?;', ['last_sync_cursor']);
    return res.values && res.values.length > 0 ? res.values[0].value : '1970-01-01T00:00:00.000Z';
  },

  async setLastSyncCursor(cursor) {
    if (!dbInstance) await this.initDatabase();
    await dbInstance.run(
      'INSERT INTO sync_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?;',
      ['last_sync_cursor', cursor, cursor]
    );
    return true;
  }
};
