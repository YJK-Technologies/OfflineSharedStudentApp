import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import Navbar from './components/Navbar';
import SyncStatusBar from './components/SyncStatusBar';
import StudentList from './pages/StudentList';
import StudentForm from './pages/StudentForm';
import ServerConfigModal from './components/ServerConfigModal';
import { 
  getStudents, 
  createStudent, 
  updateStudent, 
  deleteStudent, 
  getPendingSyncCount 
} from './services/studentService';
import { 
  synchronizeNow, 
  startAutoSync, 
  subscribeSyncEvents 
} from './services/syncService';
import { checkServerHealth } from './services/apiService';
import db from './database';

export default function App() {
  const [students, setStudents] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [syncError, setSyncError] = useState(null);

  // Modal State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);

  // Platform detection
  const platformName = db.name;

  // Load students from local SQLite
  const loadLocalData = useCallback(async () => {
    try {
      const data = await getStudents(searchQuery);
      setStudents(data);
      const pending = await getPendingSyncCount();
      setPendingCount(pending);
      const cursor = await db.getLastSyncCursor();
      setLastSyncTime(cursor);
    } catch (err) {
      console.error('[App] Failed loading local data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery]);

  // Network health prober
  const checkReachability = useCallback(async () => {
    const reachable = await checkServerHealth();
    setIsOnline(reachable);
  }, []);

  // Initialization & Event Subscriptions
  useEffect(() => {
    // 1. Initialize local SQLite database
    db.initDatabase()
      .then(() => loadLocalData())
      .catch(err => console.error('Database initialization error:', err));

    // 2. Health check initial
    checkReachability();

    // 3. Subscribe to sync engine events
    const unsubscribeSync = subscribeSyncEvents((event) => {
      if (event.type === 'sync_start') {
        setIsSyncing(true);
        setSyncError(null);
      } else if (event.type === 'sync_success') {
        setIsSyncing(false);
        setLastSyncTime(event.data.newCursor);
        setSyncError(null);
        loadLocalData();
      } else if (event.type === 'sync_offline') {
        setIsSyncing(false);
        setIsOnline(false);
        loadLocalData();
      } else if (event.type === 'sync_error') {
        setIsSyncing(false);
        setSyncError(event.error);
        loadLocalData();
      }
    });

    // 4. Start automatic background synchronization
    const stopAutoSync = startAutoSync(process.env.REACT_APP_SYNC_INTERVAL_MS || 30000);

    // 5. Native network change listeners
    const handleOnline = () => {
      checkReachability();
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Periodic network reachability probe (every 10 seconds)
    const probeInterval = setInterval(checkReachability, 10000);

    return () => {
      unsubscribeSync();
      stopAutoSync();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(probeInterval);
    };
  }, [loadLocalData, checkReachability]);

  // Reload data whenever search query changes
  useEffect(() => {
    loadLocalData();
  }, [loadLocalData]);

  // User Action Handlers (All write directly to local SQLite!)
  const handleOpenAdd = () => {
    setEditingStudent(null);
    setIsFormOpen(true);
  };

  const handleEditStudent = (student) => {
    setEditingStudent(student);
    setIsFormOpen(true);
  };

  const handleSaveStudent = async (studentData) => {
    if (editingStudent) {
      await updateStudent(editingStudent.id, studentData);
    } else {
      await createStudent(studentData);
    }
    await loadLocalData();

    // If online, trigger background sync opportunistically
    if (isOnline) {
      synchronizeNow();
    }
  };

  const handleDeleteStudent = async (student) => {
    if (window.confirm(`Are you sure you want to delete ${student.name}? The record will be soft-deleted locally and synchronized when online.`)) {
      await deleteStudent(student.id);
      await loadLocalData();
      if (isOnline) {
        synchronizeNow();
      }
    }
  };

  const handleManualSync = async () => {
    await synchronizeNow();
    await loadLocalData();
  };

  return (
    <div className="app-root">
      <Navbar 
        platformName={platformName}
        isOnline={isOnline}
        onOpenAddStudent={handleOpenAdd}
        onOpenServerConfig={() => setIsConfigOpen(true)}
      />

      <SyncStatusBar 
        pendingCount={pendingCount}
        isSyncing={isSyncing}
        lastSyncTime={lastSyncTime}
        syncError={syncError}
        onTriggerSync={handleManualSync}
      />

      <main className="main-content">
        <StudentList 
          students={students}
          isLoading={isLoading}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onOpenAdd={handleOpenAdd}
          onEditStudent={handleEditStudent}
          onDeleteStudent={handleDeleteStudent}
        />
      </main>

      <StudentForm 
        isOpen={isFormOpen}
        studentToEdit={editingStudent}
        onClose={() => setIsFormOpen(false)}
        onSave={handleSaveStudent}
      />

      <ServerConfigModal 
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
        onServerConfigured={() => {
          checkReachability();
          loadLocalData();
        }}
      />
    </div>
  );
}
