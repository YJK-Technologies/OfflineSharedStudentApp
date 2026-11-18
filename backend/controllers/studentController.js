/**
 * Student CRUD Controller for Central REST API
 * 
 * Supports both direct REST calls and sync engine operations.
 * Enforces validation, UUID presence, versioning, and soft deletion.
 */

const { getDb, getStatements } = require('../database');
const crypto = require('crypto');

/**
 * Helper to generate UUID if not provided
 */
function generateUUID() {
  return crypto.randomUUID ? crypto.randomUUID() : `std_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Validate student payload
 */
function validateStudent(payload, isUpdate = false) {
  const errors = [];
  if (!payload) {
    return ['Request body cannot be empty'];
  }
  if (!payload.name || typeof payload.name !== 'string' || payload.name.trim().length === 0) {
    errors.push('Student name is required');
  }
  if (!payload.mobile || typeof payload.mobile !== 'string' || payload.mobile.trim().length === 0) {
    errors.push('Mobile number is required');
  }
  if (!payload.email || typeof payload.email !== 'string' || !payload.email.includes('@')) {
    errors.push('Valid email address is required');
  }
  if (isUpdate && !payload.id) {
    errors.push('Student ID is required for update');
  }
  return errors;
}

/**
 * GET /getStudents
 * Returns all active (non-deleted) students from central database
 */
exports.getStudents = (req, res) => {
  try {
    const db = getDb();
    if (!db) {
      return res.status(500).json({ success: false, error: 'Database is not initialized' });
    }
    const stmts = getStatements();
    const students = stmts.selectAllActive.all();

    return res.status(200).json({
      success: true,
      count: students.length,
      data: students
    });
  } catch (error) {
    console.error('Error fetching students:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve students: ' + error.message
    });
  }
};

/**
 * POST /studentsInsert
 * Direct insert of a student record into central database
 */
exports.studentsInsert = (req, res) => {
  try {
    const errors = validateStudent(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ success: false, errors });
    }

    const db = getDb();
    if (!db) {
      return res.status(500).json({ success: false, error: 'Database not initialized' });
    }

    const stmts = getStatements();
    const now = new Date().toISOString();
    const student = {
      id: req.body.id || generateUUID(),
      name: req.body.name.trim(),
      mobile: req.body.mobile.trim(),
      email: req.body.email.trim().toLowerCase(),
      created_at: req.body.created_at || now,
      updated_at: req.body.updated_at || now,
      is_deleted: 0,
      version: typeof req.body.version === 'number' ? req.body.version : 1,
      server_updated_at: now
    };

    // Execute within transaction
    const insertTx = db.transaction((item) => {
      // Check if student with this ID already exists
      const existing = stmts.selectById.get(item.id);
      if (existing) {
        throw new Error(`Student with ID ${item.id} already exists`);
      }
      stmts.insertStudent.run(item);
    });

    insertTx(student);

    return res.status(201).json({
      success: true,
      message: 'Student created successfully',
      data: student
    });
  } catch (error) {
    console.error('Error inserting student:', error);
    return res.status(error.message.includes('already exists') ? 409 : 500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * POST /studentUpdate
 * Direct update of a student record in central database
 */
exports.studentUpdate = (req, res) => {
  try {
    const errors = validateStudent(req.body, true);
    if (errors.length > 0) {
      return res.status(400).json({ success: false, errors });
    }

    const db = getDb();
    if (!db) {
      return res.status(500).json({ success: false, error: 'Database not initialized' });
    }

    const stmts = getStatements();
    const now = new Date().toISOString();

    const updateTx = db.transaction((payload) => {
      const existing = stmts.selectById.get(payload.id);
      if (!existing) {
        throw new Error(`Student with ID ${payload.id} not found`);
      }

      const updatedRecord = {
        id: payload.id,
        name: payload.name.trim(),
        mobile: payload.mobile.trim(),
        email: payload.email.trim().toLowerCase(),
        updated_at: payload.updated_at || now,
        is_deleted: typeof payload.is_deleted === 'number' ? payload.is_deleted : existing.is_deleted,
        version: (existing.version || 1) + 1,
        server_updated_at: now
      };

      stmts.updateStudent.run(updatedRecord);
      return updatedRecord;
    });

    const result = updateTx(req.body);

    return res.status(200).json({
      success: true,
      message: 'Student updated successfully',
      data: result
    });
  } catch (error) {
    console.error('Error updating student:', error);
    return res.status(error.message.includes('not found') ? 404 : 500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * POST /studentDelete
 * Soft delete student by ID in central database (sets is_deleted = 1)
 */
exports.studentDelete = (req, res) => {
  try {
    const { id } = req.body;
    if (!id) {
      return res.status(400).json({ success: false, error: 'Student ID is required' });
    }

    const db = getDb();
    if (!db) {
      return res.status(500).json({ success: false, error: 'Database not initialized' });
    }

    const stmts = getStatements();
    const now = new Date().toISOString();

    const deleteTx = db.transaction((studentId) => {
      const existing = stmts.selectById.get(studentId);
      if (!existing) {
        throw new Error(`Student with ID ${studentId} not found`);
      }
      stmts.softDeleteStudent.run({
        id: studentId,
        updated_at: now,
        server_updated_at: now
      });
      return { id: studentId, is_deleted: 1 };
    });

    const result = deleteTx(id);

    return res.status(200).json({
      success: true,
      message: 'Student soft deleted successfully',
      data: result
    });
  } catch (error) {
    console.error('Error deleting student:', error);
    return res.status(error.message.includes('not found') ? 404 : 500).json({
      success: false,
      error: error.message
    });
  }
};
