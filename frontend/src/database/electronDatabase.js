/**
 * Electron Database Adapter
 * Routes calls through the secure preload IPC bridge to better-sqlite3 in Electron main process
 */

export const electronDatabase = {
  name: 'Electron SQLite (better-sqlite3)',

  async initDatabase() {
    if (!window.electronAPI || !window.electronAPI.database) {
      throw new Error('Electron API bridge is not available');
    }
    return await window.electronAPI.database.initDatabase();
  },

  async getAllStudents(includeDeleted = false) {
    return await window.electronAPI.database.getAllStudents(includeDeleted);
  },

  async getStudentById(id) {
    return await window.electronAPI.database.getStudentById(id);
  },

  async insertStudent(student) {
    return await window.electronAPI.database.insertStudent(student);
  },

  async updateStudent(student) {
    return await window.electronAPI.database.updateStudent(student);
  },

  async deleteStudent(id) {
    return await window.electronAPI.database.deleteStudent(id);
  },

  async getPendingSyncRecords() {
    return await window.electronAPI.database.getPendingSyncRecords();
  },

  async markRecordsAsSynced(ids, serverTimestamps) {
    return await window.electronAPI.database.markRecordsAsSynced(ids, serverTimestamps);
  },

  async applyPullChanges(records, newCursor) {
    return await window.electronAPI.database.applyPullChanges(records, newCursor);
  },

  async getLastSyncCursor() {
    return await window.electronAPI.database.getLastSyncCursor();
  },

  async setLastSyncCursor(cursor) {
    return await window.electronAPI.database.setLastSyncCursor(cursor);
  }
};
