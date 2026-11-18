/**
 * Student Service Layer
 * 
 * Mediates between React UI components and the platform-specific local SQLite database.
 * Every user action writes directly to the local SQLite database first, guaranteeing 100% offline capability.
 */

import db from '../database';

/**
 * Robust UUID v4 generator for both modern browsers and legacy WebViews
 */
export function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Validate input student data
 */
export function validateStudentInput(data) {
  const errors = {};
  if (!data.name || !data.name.trim()) {
    errors.name = 'Student name is required';
  }
  if (!data.mobile || !data.mobile.trim()) {
    errors.mobile = 'Mobile number is required';
  } else if (!/^\+?[0-9\s-]{7,15}$/.test(data.mobile.trim())) {
    errors.mobile = 'Please enter a valid mobile number';
  }
  if (!data.email || !data.email.trim()) {
    errors.email = 'Email address is required';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) {
    errors.email = 'Please enter a valid email address';
  }
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

/**
 * Fetch all active students from local SQLite
 */
export async function getStudents(searchQuery = '') {
  try {
    const all = await db.getAllStudents(false);
    if (!searchQuery.trim()) {
      return all;
    }
    const q = searchQuery.toLowerCase().trim();
    return all.filter(s => 
      (s.name && s.name.toLowerCase().includes(q)) ||
      (s.email && s.email.toLowerCase().includes(q)) ||
      (s.mobile && s.mobile.includes(q)) ||
      (s.id && s.id.toLowerCase().includes(q))
    );
  } catch (err) {
    console.error('[StudentService] getStudents error:', err);
    throw new Error('Unable to read students from local database: ' + err.message);
  }
}

/**
 * Fetch single student by ID from local SQLite
 */
export async function getStudentById(id) {
  try {
    return await db.getStudentById(id);
  } catch (err) {
    console.error('[StudentService] getStudentById error:', err);
    throw new Error('Failed to find student record: ' + err.message);
  }
}

/**
 * Create a new student (Saved into local SQLite with status: 'pending_insert')
 */
export async function createStudent(studentData) {
  const validation = validateStudentInput(studentData);
  if (!validation.isValid) {
    const firstErr = Object.values(validation.errors)[0];
    throw new Error(firstErr);
  }

  const now = new Date().toISOString();
  const record = {
    id: generateUUID(),
    name: studentData.name.trim(),
    mobile: studentData.mobile.trim(),
    email: studentData.email.trim().toLowerCase(),
    created_at: now,
    updated_at: now,
    is_deleted: 0,
    sync_status: 'pending_insert',
    version: 1
  };

  try {
    return await db.insertStudent(record);
  } catch (err) {
    console.error('[StudentService] createStudent error:', err);
    throw new Error('Failed to save student locally: ' + err.message);
  }
}

/**
 * Update student locally (Saved into local SQLite with status: 'pending_update')
 */
export async function updateStudent(id, studentData) {
  const validation = validateStudentInput(studentData);
  if (!validation.isValid) {
    const firstErr = Object.values(validation.errors)[0];
    throw new Error(firstErr);
  }

  try {
    return await db.updateStudent({
      id,
      name: studentData.name.trim(),
      mobile: studentData.mobile.trim(),
      email: studentData.email.trim().toLowerCase()
    });
  } catch (err) {
    console.error('[StudentService] updateStudent error:', err);
    throw new Error('Failed to update student locally: ' + err.message);
  }
}

/**
 * Soft delete student locally (Marks is_deleted = 1 and status: 'pending_delete')
 */
export async function deleteStudent(id) {
  try {
    return await db.deleteStudent(id);
  } catch (err) {
    console.error('[StudentService] deleteStudent error:', err);
    throw new Error('Failed to delete student: ' + err.message);
  }
}

/**
 * Get count of pending records awaiting sync
 */
export async function getPendingSyncCount() {
  try {
    const pending = await db.getPendingSyncRecords();
    return pending.length;
  } catch (err) {
    console.warn('[StudentService] getPendingSyncCount warning:', err);
    return 0;
  }
}
