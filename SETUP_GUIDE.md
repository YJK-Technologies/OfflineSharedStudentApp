# Complete Step-by-Step Execution Guide (Windows 10 / 11)

This guide takes a beginner from zero to running and building:
1. Central Node.js & SQLite REST API Backend
2. Windows Desktop Application (.EXE) via Electron
3. Android Mobile Application (.APK) via Capacitor
4. Offline CRUD and Two-Way Push/Pull Cross-Device Synchronization

---

## 1. Required Software Prerequisites

Install the following software on Windows 10 or 11:

1. **Node.js LTS (v18.x or v20.x)**
   - Download: https://nodejs.org/
   - Verify in PowerShell:
     ```powershell
     node -v
     npm -v
     ```
2. **Git for Windows**
   - Download: https://git-scm.com/download/win
3. **Visual Studio C++ Build Tools (Required for compiling `better-sqlite3` native binaries)**
   - In PowerShell as Administrator:
     ```powershell
     npm install --global --production windows-build-tools
     # Or install "Desktop development with C++" using Visual Studio Community Installer
     ```
4. **Android Studio (Ladybug / Koala or newer)**
   - Download: https://developer.android.com/studio
   - During setup, install:
     - Android SDK Platform 34 (Android 14) or 33
     - Android SDK Command-line Tools
     - Android SDK Build-Tools
     - Android Virtual Device (AVD Emulator) e.g., Pixel 7 API 34
5. **Java JDK 17 (Required by Android Gradle)**
   - Included automatically with Android Studio (`jbr` folder) or via OpenJDK 17.

---

## 2. Project Directory Structure

```
OfflineSharedStudentApp/
├── .env.example
├── README.md
├── SETUP_GUIDE.md
├── backend/
│   ├── .env.example
│   ├── package.json
│   ├── server.js
│   ├── database.js
│   ├── controllers/
│   │   ├── studentController.js
│   │   └── syncController.js
│   └── routes/
│       ├── studentRoutes.js
│       └── syncRoutes.js
└── frontend/
    ├── .env.example
    ├── package.json
    ├── capacitor.config.json
    ├── electron-builder.json
    ├── public/
    │   └── index.html
    ├── electron/
    │   ├── main.js
    │   ├── preload.js
    │   └── database.js
    └── src/
        ├── index.js
        ├── App.js
        ├── App.css
        ├── components/
        │   ├── Navbar.js
        │   ├── SyncStatusBar.js
        │   └── StudentCard.js
        ├── pages/
        │   ├── StudentList.js
        │   └── StudentForm.js
        ├── database/
        │   ├── index.js
        │   ├── electronDatabase.js
        │   ├── capacitorDatabase.js
        │   └── webDatabase.js
        └── services/
            ├── apiService.js
            ├── studentService.js
            └── syncService.js
```

---

## 3. Step 1: Setting Up & Starting the Backend

Open PowerShell terminal in `OfflineSharedStudentApp\backend`:

```powershell
# Navigate into backend directory
cd backend

# Create .env from template
Copy-Item .env.example .env

# Install backend dependencies
npm install

# Start the Central SQLite Backend server
npm start
```

You should see:
```
[Central Database] SQLite database connected at: ./central_students.db
[Central Database] Schema tables & indexes verified successfully.
🚀 Central SQLite Backend running on http://0.0.0.0:5000
📡 Health Check: http://0.0.0.0:5000/health
```

Test the health check in a web browser or PowerShell:
```powershell
Invoke-RestMethod -Uri http://localhost:5000/health
```

---

## 4. Step 2: Setting Up the Frontend

Open a **new** PowerShell terminal in `OfflineSharedStudentApp\frontend`:

```powershell
# Navigate into frontend directory
cd frontend

# Create .env from template
Copy-Item .env.example .env

# Install frontend dependencies
npm install

# Rebuild better-sqlite3 for Electron native runtime
npx electron-rebuild -f -w better-sqlite3
```

---

## 5. Step 3: Running in Web Browser (Dev Mode)

To quickly preview in browser:
```powershell
npm start
```
The application opens at `http://localhost:3000`. You can add, edit, search, and delete students. All data is saved in local browser storage and synchronizes with `http://localhost:5000`.

---

## 6. Step 4: Running the Windows Desktop Application (Electron)

Make sure the backend is running in Terminal 1, then in Terminal 2:

```powershell
# Terminal 2: Start CRA React server
npm start
```

Open a **third** PowerShell terminal in `frontend`:
```powershell
# Terminal 3: Launch Electron connected to React dev server
npm run electron:dev
```

A native Windows window titled **"Offline Student Manager (Windows Desktop)"** will open.
- Local SQLite database is automatically created in `%APPDATA%\com.offline.studentmanager\student_manager_local.db`.
- Check top badge: Displays `Electron SQLite (better-sqlite3)`.

---

## 7. Step 5: Testing Offline CRUD on Windows Desktop

1. **Simulate Offline:**
   - Temporarily disable your computer's WiFi or stop the backend terminal (`Ctrl + C` in backend PowerShell).
   - The top status bar changes to: `No Connection (Offline)` / `Central server currently offline. Data saved safely locally.`
2. **Add Student Arun:**
   - Click **Add Student**.
   - Name: `Arun`
   - Mobile: `9876543210`
   - Email: `arun@example.com`
   - Click **Create Student**.
3. **Verify Local Save:**
   - Arun immediately appears in the list!
   - Status badge shows: `Pending Insert` and pending count increases to `1 record`.
   - Close the Electron app and reopen it. Arun is still there, safely preserved in local SQLite file `student_manager_local.db`!

---

## 8. Step 6: Setting Up Android Studio & Capacitor

1. In the `frontend` PowerShell terminal, build the web assets:
   ```powershell
   npm run build
   ```
2. Add the Android native platform:
   ```powershell
   npx cap add android
   ```
3. Copy local build assets and sync SQLite native plugin:
   ```powershell
   npx cap sync android
   ```
4. Configure Network Security (allow HTTP communication to local backend during development):
   Open `android/app/src/main/AndroidManifest.xml` and ensure `usesCleartextTraffic` is enabled:
   ```xml
   <application
       android:usesCleartextTraffic="true"
       ... >
   ```
5. Open the project in Android Studio:
   ```powershell
   npx cap open android
   ```
6. In Android Studio:
   - Wait for Gradle sync to complete.
   - Start an Android Emulator (e.g. Pixel 7, API 34).
   - Press the Green **Run** button (or Shift + F10).

> **Important Android Networking Note:**
> The Android emulator communicates with your host PC's `localhost` using IP `http://10.0.2.2:5000`.
> Our `frontend/src/services/apiService.js` automatically routes Android requests to `10.0.2.2:5000`!

---

## 9. Step 7: Testing Offline CRUD on Android APK

1. On the Android emulator, toggle Airplane Mode **ON** in the emulator quick settings.
2. In the app, verify status shows: `No Connection (Offline)`.
3. Tap **Add Student**:
   - Name: `Kumar`
   - Mobile: `9123456780`
   - Email: `kumar@example.com`
   - Tap **Create Student**.
4. Kumar appears instantly in the list with `Pending Insert` and `v1`.
5. Data is committed into Android local SQLite (`students_local_db`).

---

## 10. Step 8: Cross-Device Synchronization Test (Windows + Android)

Follow this exact test sequence to verify seamless multi-device synchronization:

### Test Scenario 1: Reconnecting and Syncing
1. Ensure the Node.js backend is running (`http://localhost:5000`).
2. Turn WiFi back on for Windows.
3. Turn Airplane Mode **OFF** on Android emulator.
4. On Windows Electron: Click **Sync Now**.
   - Status changes to `Synced`.
   - Arun's record is pushed to Central SQLite `central_students.db`.
5. On Android Mobile: Tap **Sync Now**.
   - Kumar's record is pushed to Central SQLite.
   - Android's pull engine fetches Arun from the Central SQLite!
   - Now **both Arun and Kumar** appear on Android!
6. Go back to Windows Electron and click **Sync Now**.
   - Windows pulls Kumar from Central SQLite.
   - Now **both Arun and Kumar** appear on Windows!

### Test Scenario 2: Offline Edit & Delete Sync
1. Turn off network on both devices.
2. **On Windows Desktop (Offline):**
   - Click **Edit** on Kumar. Change mobile to `9999999999`.
   - Status updates locally to `Pending Update`, version increments to `v2`.
3. **On Android Mobile (Offline):**
   - Click **Delete** on Arun.
   - Arun is soft-deleted locally (`is_deleted = 1`), status becomes `Pending Delete`.
4. Turn on network and start backend.
5. Click **Sync Now** on Windows, then **Sync Now** on Android.
6. Central SQLite and both devices are now perfectly synchronized:
   - Arun is deleted across all devices.
   - Kumar has the updated phone number `9999999999` across all devices.

---

## 11. Step 9: Building the Windows Installer (.EXE)

To create a standalone production Windows installer:

```powershell
cd frontend

# Build optimized production React bundle
npm run build

# Package into standalone Windows 64-bit NSIS installer
npm run electron:dist
```

The compiled installer will be generated in:
`frontend/dist_electron/Offline Student Manager Setup 1.0.0.exe`

You can run this `.exe` on any Windows 10 or 11 machine without needing Node.js or development tools installed!

---

## 12. Step 10: Building the Android Release APK

To create the final standalone Android APK:

```powershell
cd frontend

# Build React bundle & sync to Android project
npm run build
npx cap sync android

# Build Release APK via Gradle wrapper
cd android
.\gradlew assembleRelease
```

The APK will be located at:
`frontend/android/app/build/outputs/apk/release/app-release-unsigned.apk`

For development testing, you can also build a debug APK anytime with:
```powershell
.\gradlew assembleDebug
```
Output: `frontend/android/app/build/outputs/apk/debug/app-debug.apk`.

---

## 13. Troubleshooting Common Errors

### Error: "better-sqlite3 was compiled against a different Node.js version"
- **Cause:** Electron uses a different V8 / ABI version than standard Node.js.
- **Fix:** In `frontend/`, run:
  ```powershell
  npx electron-rebuild -f -w better-sqlite3
  ```

### Error: "CLEARTEXT communication to 10.0.2.2 not permitted by network security policy"
- **Cause:** Android 9+ blocks unencrypted HTTP traffic by default.
- **Fix:** In `android/app/src/main/AndroidManifest.xml`, make sure `<application android:usesCleartextTraffic="true">` is present.

### Error: "Failed to fetch / Connection refused on Android"
- **Cause:** Android cannot connect to `localhost:5000` because `localhost` refers to the mobile phone itself.
- **Fix:** Use `http://10.0.2.2:5000` for the Android emulator, or your computer's local LAN IP (e.g. `http://192.168.1.50:5000`) for a physical Android smartphone connected via WiFi.
