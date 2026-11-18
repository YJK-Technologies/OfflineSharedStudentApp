/**
 * Electron Preload Script
 * 
 * Safely bridges IPC methods between the main Electron process and the React renderer.
 * Enforces contextIsolation: true and nodeIntegration: false.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: 'electron-windows',
  database: {
    initDatabase: () => ipcRenderer.invoke('db:init'),
    getAllStudents: (includeDeleted = false) => ipcRenderer.invoke('db:getAllStudents', includeDeleted),
    getStudentById: (id) => ipcRenderer.invoke('db:getStudentById', id),
    insertStudent: (student) => ipcRenderer.invoke('db:insertStudent', student),
    updateStudent: (student) => ipcRenderer.invoke('db:updateStudent', student),
    deleteStudent: (id) => ipcRenderer.invoke('db:deleteStudent', id),
    getPendingSyncRecords: () => ipcRenderer.invoke('db:getPendingSyncRecords'),
    markRecordsAsSynced: (ids, serverTimestamps) => ipcRenderer.invoke('db:markRecordsAsSynced', ids, serverTimestamps),
    applyPullChanges: (records, newCursor) => ipcRenderer.invoke('db:applyPullChanges', records, newCursor),
    getLastSyncCursor: () => ipcRenderer.invoke('db:getLastSyncCursor'),
    setLastSyncCursor: (cursor) => ipcRenderer.invoke('db:setLastSyncCursor', cursor)
  }
});
