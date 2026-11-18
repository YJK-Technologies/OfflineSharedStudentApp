import React from 'react';

export default function StudentCard({ student, onEdit, onDelete }) {
  const getSyncStatusBadge = (status) => {
    switch (status) {
      case 'synced':
        return <span className="sync-tag synced">Synced</span>;
      case 'pending_insert':
        return <span className="sync-tag pending-insert">Pending Insert</span>;
      case 'pending_update':
        return <span className="sync-tag pending-update">Pending Update</span>;
      case 'pending_delete':
        return <span className="sync-tag pending-delete">Pending Delete</span>;
      default:
        return <span className="sync-tag">{status}</span>;
    }
  };

  const formatDate = (isoString) => {
    if (!isoString) return '-';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return isoString;
    }
  };

  return (
    <div className={`student-card ${student.is_deleted ? 'deleted-card' : ''}`}>
      <div className="card-top-row">
        <div className="student-identity">
          <div className="avatar-circle">
            {student.name ? student.name.charAt(0).toUpperCase() : 'S'}
          </div>
          <div>
            <h3 className="student-name">{student.name}</h3>
            <span className="student-id-code" title={student.id}>ID: {student.id.substring(0, 18)}...</span>
          </div>
        </div>

        <div className="card-status-badges">
          {getSyncStatusBadge(student.sync_status)}
          <span className="version-pill">v{student.version || 1}</span>
        </div>
      </div>

      <div className="card-details-grid">
        <div className="detail-item">
          <span className="detail-label">Mobile</span>
          <span className="detail-value">{student.mobile}</span>
        </div>

        <div className="detail-item">
          <span className="detail-label">Email</span>
          <span className="detail-value">{student.email}</span>
        </div>

        <div className="detail-item">
          <span className="detail-label">Created</span>
          <span className="detail-value">{formatDate(student.created_at)}</span>
        </div>

        <div className="detail-item">
          <span className="detail-label">Updated</span>
          <span className="detail-value">{formatDate(student.updated_at)}</span>
        </div>
      </div>

      <div className="card-actions-row">
        <button 
          className="btn-action btn-edit"
          onClick={() => onEdit(student)}
          title="Edit student details locally"
        >
          <svg className="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
          <span>Edit</span>
        </button>

        <button 
          className="btn-action btn-delete"
          onClick={() => onDelete(student)}
          title="Delete student (soft-deleted locally, marks pending sync)"
        >
          <svg className="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
          <span>Delete</span>
        </button>
      </div>
    </div>
  );
}
