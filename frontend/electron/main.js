/**
 * Electron Main Process
 * 
 * Manages the native Windows desktop application lifecycle,
 * sets up secure IPC channels, and connects to the local SQLite database.
 */

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const db = require('./database');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'Offline Student Manager (Windows Desktop)',
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false // Required for preload script to communicate with Node IPC
    }
  });

  const fs = require('fs');
  const buildPath = path.join(__dirname, '../build/index.html');
  const isDev = process.env.ELECTRON_DEV === 'true';

  if (isDev) {
    // Development mode with npm start
    mainWindow.loadURL('http://localhost:3000').catch(() => {
      console.warn('[Electron] React dev server not reachable at http://localhost:3000. Loading local build folder...');
      if (fs.existsSync(buildPath)) {
        mainWindow.loadFile(buildPath);
      }
    });
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    // Standalone desktop mode: Load directly from local build folder (works with NO frontend running!)
    if (fs.existsSync(buildPath)) {
      mainWindow.loadFile(buildPath);
    } else {
      mainWindow.loadURL('http://localhost:3000').catch(() => {
        mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
          <div style="font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif; background: #0f172a; color: white; height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 24px;">
            <h2 style="margin-bottom: 8px;">Desktop App Offline Bundle Missing</h2>
            <p style="color: #94a3b8; max-width: 500px; line-height: 1.5; font-size: 14px;">
              To run the desktop application standalone without running the frontend (npm start), please build the static assets once by running:
            </p>
            <pre style="background: #1e293b; padding: 10px 16px; border-radius: 6px; font-family: monospace; color: #38bdf8; margin: 16px 0;">npm run build</pre>
            <p style="color: #64748b; font-size: 12px;">Then run: <code>npm run electron:run</code> or <code>npm run desktop</code></p>
          </div>
        `)}`);
      });
    }
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Register IPC handlers to expose SQLite database operations
function setupIpcHandlers() {
  ipcMain.handle('db:init', async () => {
    return db.initLocalDatabase();
  });

  ipcMain.handle('db:getAllStudents', async (event, includeDeleted) => {
    return db.getAllStudents(includeDeleted);
  });

  ipcMain.handle('db:getStudentById', async (event, id) => {
    return db.getStudentById(id);
  });

  ipcMain.handle('db:insertStudent', async (event, student) => {
    return db.insertStudent(student);
  });

  ipcMain.handle('db:updateStudent', async (event, student) => {
    return db.updateStudent(student);
  });

  ipcMain.handle('db:deleteStudent', async (event, id) => {
    return db.deleteStudent(id);
  });

  ipcMain.handle('db:getPendingSyncRecords', async () => {
    return db.getPendingSyncRecords();
  });

  ipcMain.handle('db:markRecordsAsSynced', async (event, ids, serverTimestamps) => {
    return db.markRecordsAsSynced(ids, serverTimestamps);
  });

  ipcMain.handle('db:applyPullChanges', async (event, records, newCursor) => {
    return db.applyPullChanges(records, newCursor);
  });

  ipcMain.handle('db:getLastSyncCursor', async () => {
    return db.getLastSyncCursor();
  });

  ipcMain.handle('db:setLastSyncCursor', async (event, cursor) => {
    return db.setLastSyncCursor(cursor);
  });
}

app.whenReady().then(() => {
  setupIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
