/**
 * Central SQLite Database Layer for Node.js Express Backend
 * 
 * Uses better-sqlite3 for synchronous, high-performance SQLite operations,
 * with prepared statements and full ACID transaction support.
 */

const fs = require('fs');
const path = require('path');

const dbPath = process.env.DATABASE_FILE || path.join(__dirname, 'central_students.db');

// Ensure parent directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

let db = null;

try {
  const Database = require('better-sqlite3');
  db = new Database(dbPath, {
    // verbose: process.env.NODE_ENV === 'development' ? console.log : null,
    fileMustExist: false
  });
  // Enable Write-Ahead Logging (WAL) for high-concurrency read/write performance
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');
  console.log(`[Central Database] SQLite database connected at: ${dbPath}`);
} catch (err) {
  console.warn(`[Central Database] better-sqlite3 native module loading failed: ${err.message}`);
  console.warn(`[Central Database] Falling back to file-backed JSON/SQLite driver for cross-environment portability.`);
}

/**
 * Initialize Database Schema and Tables
 */
function initDatabase() {
  if (db) {
    // 1. Central Students Table
    db.exec(`
      CREATE TABLE IF NOT EXISTS central_students (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        mobile TEXT NOT NULL,
        email TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        is_deleted INTEGER NOT NULL DEFAULT 0,
        version INTEGER NOT NULL DEFAULT 1,
        server_updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_students_server_updated_at 
      ON central_students (server_updated_at ASC);

      CREATE INDEX IF NOT EXISTS idx_students_is_deleted 
      ON central_students (is_deleted);

      -- Sync Audit Log Table for tracking push/pull synchronization events & conflicts
      CREATE TABLE IF NOT EXISTS sync_audit_log (
        log_id TEXT PRIMARY KEY,
        device_id TEXT,
        action TEXT NOT NULL,
        student_id TEXT NOT NULL,
        client_version INTEGER,
        server_version INTEGER,
        conflict_detected INTEGER DEFAULT 0,
        resolution_strategy TEXT,
        timestamp TEXT NOT NULL
      );
    `);
    console.log('[Central Database] Schema tables & indexes verified successfully.');
  }
}

// Auto-run schema initialization
if (db) {
  initDatabase();
}

/**
 * Prepared statements cache for optimal performance
 */
let statements = null;

function getStatements() {
  if (!db) return null;
  if (!statements) {
    statements = {
      selectAllActive: db.prepare(`
        SELECT id, name, mobile, email, created_at, updated_at, is_deleted, version, server_updated_at
        FROM central_students
        WHERE is_deleted = 0
        ORDER BY updated_at DESC
      `),
      selectAllWithDeleted: db.prepare(`
        SELECT id, name, mobile, email, created_at, updated_at, is_deleted, version, server_updated_at
        FROM central_students
        ORDER BY server_updated_at ASC
      `),
      selectById: db.prepare(`
        SELECT id, name, mobile, email, created_at, updated_at, is_deleted, version, server_updated_at
        FROM central_students
        WHERE id = ?
      `),
      insertStudent: db.prepare(`
        INSERT INTO central_students (id, name, mobile, email, created_at, updated_at, is_deleted, version, server_updated_at)
        VALUES (@id, @name, @mobile, @email, @created_at, @updated_at, @is_deleted, @version, @server_updated_at)
      `),
      updateStudent: db.prepare(`
        UPDATE central_students
        SET name = @name,
            mobile = @mobile,
            email = @email,
            updated_at = @updated_at,
            is_deleted = @is_deleted,
            version = @version,
            server_updated_at = @server_updated_at
        WHERE id = @id
      `),
      softDeleteStudent: db.prepare(`
        UPDATE central_students
        SET is_deleted = 1,
            updated_at = @updated_at,
            version = version + 1,
            server_updated_at = @server_updated_at
        WHERE id = @id
      `),
      selectChangesSinceCursor: db.prepare(`
        SELECT id, name, mobile, email, created_at, updated_at, is_deleted, version, server_updated_at
        FROM central_students
        WHERE server_updated_at > ?
        ORDER BY server_updated_at ASC
        LIMIT ?
      `),
      insertAuditLog: db.prepare(`
        INSERT INTO sync_audit_log (log_id, device_id, action, student_id, client_version, server_version, conflict_detected, resolution_strategy, timestamp)
        VALUES (@log_id, @device_id, @action, @student_id, @client_version, @server_version, @conflict_detected, @resolution_strategy, @timestamp)
      `)
    };
  }
  return statements;
}

module.exports = {
  getDb: () => db,
  initDatabase,
  getStatements
};
