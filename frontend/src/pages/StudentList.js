import React, { useState } from 'react';
import StudentCard from '../components/StudentCard';

export default function StudentList({ 
  students, 
  isLoading, 
  searchQuery, 
  onSearchChange, 
  onOpenAdd, 
  onEditStudent, 
  onDeleteStudent 
}) {
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'pending' | 'synced'

  const filteredStudents = students.filter(student => {
    if (filterMode === 'pending') {
      return ['pending_insert', 'pending_update', 'pending_delete'].includes(student.sync_status);
    }
    if (filterMode === 'synced') {
      return student.sync_status === 'synced';
    }
    return true;
  });

  return (
    <section className="student-list-container">
      <div className="list-controls-bar">
        <div className="search-box-wrapper">
          <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            className="search-input"
            placeholder="Search students by name, mobile, email, or ID..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          {searchQuery && (
            <button 
              className="clear-search-btn" 
              onClick={() => onSearchChange('')}
              title="Clear search"
            >
              &times;
            </button>
          )}
        </div>

        <div className="filter-segmented-control">
          <button 
            className={`filter-btn ${filterMode === 'all' ? 'active' : ''}`}
            onClick={() => setFilterMode('all')}
          >
            All ({students.length})
          </button>
          <button 
            className={`filter-btn ${filterMode === 'pending' ? 'active' : ''}`}
            onClick={() => setFilterMode('pending')}
          >
            Pending ({students.filter(s => s.sync_status !== 'synced').length})
          </button>
          <button 
            className={`filter-btn ${filterMode === 'synced' ? 'active' : ''}`}
            onClick={() => setFilterMode('synced')}
          >
            Synced ({students.filter(s => s.sync_status === 'synced').length})
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="loading-state-wrapper">
          <div className="spinner"></div>
          <p>Loading records from local SQLite...</p>
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="empty-state-wrapper">
          <div className="empty-icon-circle">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <h3 className="empty-title">
            {searchQuery 
              ? 'No students found matching your search' 
              : filterMode === 'pending' 
                ? 'No pending records awaiting synchronization' 
                : 'No student records yet'}
          </h3>
          <p className="empty-description">
            {searchQuery 
              ? 'Try adjusting your search query or clear the filter to view all students.'
              : 'Add student records offline. All data will be saved to local SQLite and synced when online.'}
          </p>
          {!searchQuery && filterMode === 'all' && (
            <button className="btn btn-primary" onClick={onOpenAdd}>
              Add First Student
            </button>
          )}
        </div>
      ) : (
        <div className="students-grid">
          {filteredStudents.map(student => (
            <StudentCard
              key={student.id}
              student={student}
              onEdit={onEditStudent}
              onDelete={onDeleteStudent}
            />
          ))}
        </div>
      )}
    </section>
  );
}
