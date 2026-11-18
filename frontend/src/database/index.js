/**
 * Universal Database Factory & Platform Detector
 * 
 * Automatically selects the appropriate local SQLite database adapter based on the runtime:
 * 1. Windows Desktop (Electron) -> uses electronDatabase (better-sqlite3 via IPC bridge)
 * 2. Android Mobile (Capacitor) -> uses capacitorDatabase (@capacitor-community/sqlite)
 * 3. Browser Web (Dev / Preview) -> uses webDatabase (Local Storage / IndexedDB sandbox)
 * 
 * The React UI components call database methods without caring which platform is executing!
 */

import { electronDatabase } from './electronDatabase';
import { capacitorDatabase } from './capacitorDatabase';
import { webDatabase } from './webDatabase';

export function getDatabaseAdapter() {
  // 1. Check if running inside Electron
  if (typeof window !== 'undefined' && window.electronAPI && window.electronAPI.database) {
    return electronDatabase;
  }

  // 2. Check if running inside Capacitor Android
  if (
    typeof window !== 'undefined' &&
    window.Capacitor &&
    typeof window.Capacitor.isNativePlatform === 'function' &&
    window.Capacitor.isNativePlatform()
  ) {
    return capacitorDatabase;
  }

  // 3. Fallback for Web Browser (Development & AI Studio sandbox)
  return webDatabase;
}

export const db = getDatabaseAdapter();

export default db;
