import React from 'react';

export default function SyncStatusBar({ 
  pendingCount, 
  isSyncing, 
  lastSyncTime, 
  syncError, 
  onTriggerSync 
}) {
  const formatTime = (isoString) => {
    if (!isoString || isoString.startsWith('1970')) return 'Never synced';
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return 'Never';
    }
  };

  return (
    <div className="sync-status-bar">
      <div className="sync-meta-group">
        <div className="sync-pending-stat">
          <span className="stat-label">Pending Sync:</span>
          <span className={`stat-value ${pendingCount > 0 ? 'has-pending' : 'all-synced'}`}>
            {pendingCount} record{pendingCount === 1 ? '' : 's'}
          </span>
        </div>

        <div className="sync-divider">·</div>

        <div className="sync-last-stat">
          <span className="stat-label">Last Central Sync:</span>
          <span className="stat-value">{formatTime(lastSyncTime)}</span>
        </div>

        {syncError && (
          <>
            <div className="sync-divider">·</div>
            <div className="sync-error-notice" title={syncError}>
              <span>Sync note: Central server currently offline. Data saved safely locally.</span>
            </div>
          </>
        )}
      </div>

      <div className="sync-action-group">
        <button 
          className="btn btn-secondary sync-btn" 
          onClick={onTriggerSync}
          disabled={isSyncing}
          title="Push pending local changes and pull central updates"
        >
          <svg className={`btn-icon ${isSyncing ? 'spin-animation' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
          </svg>
          <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
        </button>
      </div>
    </div>
  );
}
