/**
 * Offline-First Synchronization Engine
 * 
 * Orchestrates Push & Pull sync between local SQLite and remote Node.js Central Server.
 * Handles locks, offline resilience, cursor tracking, and event subscriptions.
 */

import db from '../database';
import { checkServerHealth, pushRecordsToServer, pullRecordsFromServer } from './apiService';

let isSyncInProgress = false;
const listeners = new Set();

// Client device identifier stored in local session or generated
function getDeviceId() {
  if (typeof window !== 'undefined') {
    if (window.electronAPI) return 'windows_desktop_client';
    if (window.Capacitor && window.Capacitor.isNativePlatform()) return 'android_mobile_client';
    let saved = localStorage.getItem('client_device_id');
    if (!saved) {
      saved = 'web_client_' + Math.random().toString(36).substring(2, 8);
      localStorage.setItem('client_device_id', saved);
    }
    return saved;
  }
  return 'unknown_client';
}

/**
 * Notify subscribers (UI components) of sync state updates
 */
function notifyListeners(event) {
  listeners.forEach(callback => {
    try {
      callback(event);
    } catch (e) {
      console.error('[SyncService] Listener callback error:', e);
    }
  });
}

/**
 * Subscribe to sync engine events (e.g. sync_start, sync_complete, sync_error, status_change)
 */
export function subscribeSyncEvents(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

/**
 * Main Synchronization Cycle: Push Local Changes -> Pull Remote Changes
 */
export async function synchronizeNow() {
  if (isSyncInProgress) {
    console.log('[Sync Engine] Sync is already running. Skipping concurrent request.');
    return { success: false, reason: 'ALREADY_RUNNING' };
  }

  isSyncInProgress = true;
  notifyListeners({ type: 'sync_start' });

  try {
    // 1. Connectivity Check: Verify the backend API is genuinely reachable
    const isOnline = await checkServerHealth();
    if (!isOnline) {
      console.log('[Sync Engine] Server unreachable. Preserving data locally.');
      notifyListeners({ 
        type: 'sync_offline', 
        message: 'Central server unreachable. All data remains safe in local SQLite.' 
      });
      return { success: false, reason: 'SERVER_UNREACHABLE' };
    }

    const deviceId = getDeviceId();

    // 2. Step 1: PUSH SYNCHRONIZATION
    // Read all pending local records (pending_insert, pending_update, pending_delete)
    const pendingRecords = await db.getPendingSyncRecords();
    let pushedCount = 0;

    if (pendingRecords.length > 0) {
      console.log(`[Sync Engine] Pushing ${pendingRecords.length} pending records to central server...`);
      const pushResult = await pushRecordsToServer(pendingRecords, deviceId);

      if (pushResult.success && pushResult.processedIds && pushResult.processedIds.length > 0) {
        // Mark processed records as 'synced' in local SQLite
        await db.markRecordsAsSynced(pushResult.processedIds, pushResult.serverTimestamps || {});
        pushedCount = pushResult.processedIds.length;
        console.log(`[Sync Engine] Successfully pushed & marked ${pushedCount} records as synced.`);
      }

      if (pushResult.conflicts && pushResult.conflicts.length > 0) {
        console.warn(`[Sync Engine] Handled ${pushResult.conflicts.length} conflict(s) with Last-Write-Wins policy.`);
      }
    } else {
      console.log('[Sync Engine] No pending local records to push.');
    }

    // 3. Step 2: PULL SYNCHRONIZATION
    // Fetch records modified on server since last saved cursor
    let currentCursor = await db.getLastSyncCursor();
    let hasMore = true;
    let pulledCount = 0;

    while (hasMore) {
      const pullResult = await pullRecordsFromServer(currentCursor, 100);
      if (!pullResult.success) {
        throw new Error(pullResult.error || 'Failed to pull changes from server');
      }

      const receivedRecords = pullResult.records || [];
      if (receivedRecords.length > 0) {
        // Apply remote changes to local SQLite (including soft-deletes)
        await db.applyPullChanges(receivedRecords, pullResult.newCursor);
        pulledCount += receivedRecords.length;
        currentCursor = pullResult.newCursor;
      }

      hasMore = pullResult.hasMore;
    }

    console.log(`[Sync Engine] Cycle complete: Pushed ${pushedCount}, Pulled ${pulledCount}. New cursor: ${currentCursor}`);

    const result = {
      success: true,
      pushedCount,
      pulledCount,
      newCursor: currentCursor,
      timestamp: new Date().toISOString()
    };

    notifyListeners({ type: 'sync_success', data: result });
    return result;

  } catch (error) {
    console.error('[Sync Engine Error]:', error);
    notifyListeners({ type: 'sync_error', error: error.message });
    return { success: false, reason: 'ERROR', error: error.message };
  } finally {
    isSyncInProgress = false;
  }
}

/**
 * Start Background Auto-Sync
 * - Triggers on app start
 * - Triggers when network reconnects (window 'online' event)
 * - Triggers on periodic heartbeat interval (e.g. 30s)
 */
export function startAutoSync(intervalMs = 30000) {
  // 1. Initial sync on boot
  synchronizeNow();

  // 2. Listen to browser/native online event
  const handleOnline = () => {
    console.log('[AutoSync] Network connectivity event fired. Triggering sync...');
    synchronizeNow();
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('online', handleOnline);
  }

  // 3. Periodic timer
  const timerId = setInterval(() => {
    synchronizeNow();
  }, intervalMs);

  return () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', handleOnline);
    }
    clearInterval(timerId);
  };
}
