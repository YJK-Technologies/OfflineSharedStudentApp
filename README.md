# Offline-First Cross-Platform Student Management System

A beginner-friendly, production-grade offline-first student management sample project using **ONE React JS codebase** that compiles into:
1. **Windows Desktop Application (.EXE)** using **Electron** + **better-sqlite3**
2. **Android Mobile Application (.APK)** using **Capacitor** + **@capacitor-community/sqlite**
3. **Central Synchronization Server** using **Node.js** + **Express.js** + **SQLite**

---

## Architecture Overview

```
                      React JS CRA UI
                             |
         +-------------------+-------------------+
         |                                       |
  Electron Desktop                       Capacitor Android
(Windows .EXE App)                      (Android .APK App)
         |                                       |
Windows Local SQLite                   Android Local SQLite
  (better-sqlite3)                 (@capacitor-community/sqlite)
         |                                       |
         +----------- Sync Engine ---------------+
                            |
                 Node.js Express REST API
                    (Standard fetch())
                            |
                 Central SQLite Database
                  (central_students.db)
```

---

## Key Highlights

- **Single Unified UI Codebase:** Both Windows and Android share the exact same React components (`src/`).
- **Independent Local SQLite Databases:** Windows stores data in `%APPDATA%/.../student_manager_local.db` using `better-sqlite3`, while Android stores in native device storage using `@capacitor-community/sqlite`.
- **Zero Remote File Exposure:** The remote SQLite file is never accessed directly by client apps; only through validated Node.js REST API endpoints.
- **Robust Two-Way Push/Pull Synchronization:**
  - **Push Sync:** Batches pending records (`pending_insert`, `pending_update`, `pending_delete`) to `POST /api/sync/push`.
  - **Pull Sync:** Cursor-based pagination (`GET /api/sync/pull?cursor=...`) fetching only modified records.
  - **Soft Deletion:** Deletes mark `is_deleted = 1` ensuring deletes replicate across all client devices.
  - **Conflict Resolution:** Last-Write-Wins (LWW) with server-side versioning and audit logging.
  - **Idempotency:** Repeated retries use UUIDs and never create duplicate entries.
- **Pure JavaScript:** Built with clean JavaScript (no TypeScript complexity) and standard `fetch()` (no Axios).

---

## Quick Start Summary

For complete step-by-step PowerShell instructions, see **`SETUP_GUIDE.md`**.

1. **Start Backend Server:**
   ```bash
   cd backend
   npm install
   npm start
   ```
   Backend listens at `http://localhost:5000` (`http://0.0.0.0:5000`).

2. **Start Frontend (Web Dev):**
   ```bash
   cd frontend
   npm install
   npm start
   ```

3. **Run Windows Desktop (Electron):**
   ```bash
   cd frontend
   npm run electron:dev
   ```

4. **Build Windows Installer (.EXE):**
   ```bash
   cd frontend
   npm run electron:dist
   ```

5. **Build Android APK:**
   ```bash
   cd frontend
   npm run build
   npx cap sync android
   cd android
   ./gradlew assembleDebug
   ```

---

## API Endpoints Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Server uptime & connectivity health check |
| `GET` | `/getStudents` | Returns all active central students |
| `POST` | `/studentsInsert` | Insert new student record |
| `POST` | `/studentUpdate` | Update student details |
| `POST` | `/studentDelete` | Soft-delete student record |
| `POST` | `/api/sync/push` | Push pending local records from client |
| `GET` | `/api/sync/pull` | Pull newer changes using timestamp cursor |

---

## License

MIT License. Free for learning, modification, and commercial distribution.
