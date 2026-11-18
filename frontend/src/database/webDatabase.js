/**
 * Web Local Storage Database Adapter (IndexedDB / LocalStorage)
 * Provides identical offline SQLite semantics when running in standard browser dev mode
 */

const STORAGE_KEY_STUDENTS = 'offline_students_db';
const STORAGE_KEY_CURSOR = 'offline_students_sync_cursor';

function getLocalStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_STUDENTS);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Failed reading web local storage:', e);
    return [];
  }
}

function saveLocalStore(records) {
  try {
    localStorage.setItem(STORAGE_KEY_STUDENTS, JSON.stringify(records));
  } catch (e) {
    console.error('Failed writing web local storage:', e);
  }
}

export const webDatabase = {
  name: 'Web Browser Local Storage (Dev Sandbox)',

  async initDatabase() {
    console.log('[Web Database] Initialized local browser store');
    return true;
  },

  async getAllStudents(includeDeleted = false) {
    const records = getLocalStore();
    return includeDeleted 
      ? records.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
      : records.filter(r => !r.is_deleted).sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
  },

  async getStudentById(id) {
    const records = getLocalStore();
    return records.find(r => r.id === id) || null;
  },

  async insertStudent(student) {
    const records = getLocalStore();
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
    records.push(record);
    saveLocalStore(records);
    return record;
  },

  async updateStudent(student) {
    const records = getLocalStore();
    const index = records.findIndex(r => r.id === student.id);
    if (index === -1) throw new Error('Student not found in local store');

    const existing = records[index];
    const now = new Date().toISOString();
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

    records[index] = updated;
    saveLocalStore(records);
    return updated;
  },

  async deleteStudent(id) {
    const records = getLocalStore();
    const index = records.findIndex(r => r.id === id);
    if (index !== -1) {
      records[index].is_deleted = 1;
      records[index].updated_at = new Date().toISOString();
      records[index].sync_status = 'pending_delete';
      records[index].version = (records[index].version || 1) + 1;
      saveLocalStore(records);
    }
    return { id, is_deleted: 1 };
  },

  async getPendingSyncRecords() {
    const records = getLocalStore();
    return records.filter(r => ['pending_insert', 'pending_update', 'pending_delete'].includes(r.sync_status));
  },

  async markRecordsAsSynced(ids, serverTimestamps = {}) {
    const records = getLocalStore();
    for (const record of records) {
      if (ids.includes(record.id)) {
        record.sync_status = 'synced';
        record.server_updated_at = serverTimestamps[record.id] || new Date().toISOString();
      }
    }
    saveLocalStore(records);
    return true;
  },

  async applyPullChanges(serverRecords, newCursor) {
    const records = getLocalStore();
    for (const sRec of serverRecords) {
      const idx = records.findIndex(r => r.id === sRec.id);
      if (idx === -1) {
        records.push({
          ...sRec,
          sync_status: 'synced'
        });
      } else {
        // If local is synced or server version is greater, overwrite local
        if (records[idx].sync_status === 'synced' || (sRec.version || 1) > (records[idx].version || 1)) {
          records[idx] = {
            ...sRec,
            sync_status: 'synced'
          };
        }
      }
    }
    saveLocalStore(records);
    if (newCursor) {
      await this.setLastSyncCursor(newCursor);
    }
    return true;
  },

  async getLastSyncCursor() {
    return localStorage.getItem(STORAGE_KEY_CURSOR) || '1970-01-01T00:00:00.000Z';
  },

  async setLastSyncCursor(cursor) {
    localStorage.setItem(STORAGE_KEY_CURSOR, cursor);
    return true;
  }
};
