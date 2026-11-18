/**
 * Offline Synchronization Controller for Node.js Backend
 * 
 * Implements:
 * 1. Push Synchronization (Client -> Central SQLite)
 * 2. Pull Synchronization (Central SQLite -> Client)
 * 3. Idempotent Upsert Logic (No duplicates on retries)
 * 4. Conflict Resolution (Last-Write-Wins with version tracking & audit log)
 * 5. Soft-delete propagation (is_deleted = 1)
 * 6. Cursor-based pagination
 */

const { getDb, getStatements } = require('../database');
const crypto = require('crypto');

function generateLogId() {
  return crypto.randomUUID ? crypto.randomUUID() : `log_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * POST /api/sync/push
 * Receives batch of locally modified records from Windows Desktop (Electron) or Android (Capacitor).
 * 
 * Payload structure:
 * {
 *   deviceId: "windows_client_01" | "android_client_02",
 *   records: [
 *     {
 *       id: "UUID",
 *       name: "Arun",
 *       mobile: "9876543210",
 *       email: "arun@example.com",
 *       created_at: "2026-11-12T01:00:00.000Z",
 *       updated_at: "2026-11-12T01:00:00.000Z",
 *       is_deleted: 0,
 *       version: 1
 *     }
 *   ]
 * }
 */
exports.syncPush = (req, res) => {
  try {
    const { deviceId = 'unknown_client', records = [] } = req.body;

    if (!Array.isArray(records)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid push payload: records must be an array'
      });
    }

    if (records.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No records to synchronize',
        processedIds: [],
        serverTimestamps: {},
        conflicts: []
      });
    }

    const db = getDb();
    if (!db) {
      return res.status(500).json({ success: false, error: 'Database not initialized' });
    }

    const stmts = getStatements();
    const now = new Date().toISOString();
    const processedIds = [];
    const serverTimestamps = {};
    const conflicts = [];

    // Execute atomic batch transaction
    const pushTx = db.transaction((batch) => {
      for (const record of batch) {
        if (!record.id) {
          console.warn(`[Sync Push] Skipping record without ID:`, record);
          continue;
        }

        const existing = stmts.selectById.get(record.id);

        if (!existing) {
          // 1. New Record (Insert)
          const newStudent = {
            id: record.id,
            name: (record.name || 'Unnamed').trim(),
            mobile: (record.mobile || '').trim(),
            email: (record.email || '').trim().toLowerCase(),
            created_at: record.created_at || now,
            updated_at: record.updated_at || now,
            is_deleted: record.is_deleted ? 1 : 0,
            version: typeof record.version === 'number' ? record.version : 1,
            server_updated_at: now
          };

          stmts.insertStudent.run(newStudent);
          processedIds.push(record.id);
          serverTimestamps[record.id] = now;

          // Audit Log
          stmts.insertAuditLog.run({
            log_id: generateLogId(),
            device_id: deviceId,
            action: 'INSERT',
            student_id: record.id,
            client_version: newStudent.version,
            server_version: newStudent.version,
            conflict_detected: 0,
            resolution_strategy: 'NONE',
            timestamp: now
          });
        } else {
          // 2. Existing Record (Conflict Check & Upsert)
          const clientVersion = typeof record.version === 'number' ? record.version : 1;
          const serverVersion = existing.version || 1;
          const clientUpdated = new Date(record.updated_at || 0).getTime();
          const serverUpdated = new Date(existing.updated_at || 0).getTime();

          let conflictDetected = false;
          let applyUpdate = false;
          let resolutionReason = 'NORMAL_UPDATE';

          if (clientVersion <= serverVersion && clientUpdated < serverUpdated) {
            // Conflict Detected: Central database has a strictly newer version
            conflictDetected = true;
            resolutionReason = 'SERVER_PRESERVED_LWW';
            conflicts.push({
              studentId: record.id,
              serverRecord: existing,
              clientRecord: record,
              resolution: 'Kept server version because server timestamp is newer'
            });
            // Still mark as processed so the client gets updated on next pull
            processedIds.push(record.id);
            serverTimestamps[record.id] = existing.server_updated_at;
          } else {
            // Last-Write-Wins: Client update is equal or newer, or version is incremented
            applyUpdate = true;
            if (clientVersion < serverVersion) {
              conflictDetected = true;
              resolutionReason = 'CLIENT_OVERRIDE_TIMESTAMP';
            }
          }

          if (applyUpdate) {
            const nextVersion = Math.max(serverVersion, clientVersion) + 1;
            const updatedRecord = {
              id: record.id,
              name: (record.name !== undefined ? record.name : existing.name).trim(),
              mobile: (record.mobile !== undefined ? record.mobile : existing.mobile).trim(),
              email: (record.email !== undefined ? record.email : existing.email).trim().toLowerCase(),
              updated_at: record.updated_at || now,
              is_deleted: record.is_deleted ? 1 : 0,
              version: nextVersion,
              server_updated_at: now
            };

            stmts.updateStudent.run(updatedRecord);
            processedIds.push(record.id);
            serverTimestamps[record.id] = now;

            // Audit Log
            stmts.insertAuditLog.run({
              log_id: generateLogId(),
              device_id: deviceId,
              action: record.is_deleted ? 'SOFT_DELETE' : 'UPDATE',
              student_id: record.id,
              client_version: clientVersion,
              server_version: nextVersion,
              conflict_detected: conflictDetected ? 1 : 0,
              resolution_strategy: resolutionReason,
              timestamp: now
            });
          }
        }
      }
    });

    pushTx(records);

    return res.status(200).json({
      success: true,
      message: `Successfully synchronized ${processedIds.length} records`,
      processedIds,
      serverTimestamps,
      conflicts,
      serverSyncTime: now
    });
  } catch (error) {
    console.error('[Sync Push Error]:', error);
    return res.status(500).json({
      success: false,
      error: 'Push synchronization failed: ' + error.message
    });
  }
};

/**
 * GET /api/sync/pull
 * Returns changed records newer than the client's last saved sync cursor.
 * 
 * Query parameters:
 * - cursor: ISO timestamp (e.g., '1970-01-01T00:00:00.000Z')
 * - limit: Number of records per page (default: 100, max: 500)
 */
exports.syncPull = (req, res) => {
  try {
    const db = getDb();
    if (!db) {
      return res.status(500).json({ success: false, error: 'Database not initialized' });
    }

    const cursor = req.query.cursor || '1970-01-01T00:00:00.000Z';
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);

    const stmts = getStatements();
    const records = stmts.selectChangesSinceCursor.all(cursor, limit + 1);

    const hasMore = records.length > limit;
    const paginatedRecords = hasMore ? records.slice(0, limit) : records;

    const newCursor = paginatedRecords.length > 0 
      ? paginatedRecords[paginatedRecords.length - 1].server_updated_at 
      : cursor;

    return res.status(200).json({
      success: true,
      cursor,
      newCursor,
      hasMore,
      count: paginatedRecords.length,
      records: paginatedRecords
    });
  } catch (error) {
    console.error('[Sync Pull Error]:', error);
    return res.status(500).json({
      success: false,
      error: 'Pull synchronization failed: ' + error.message
    });
  }
};
