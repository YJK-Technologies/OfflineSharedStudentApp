/**
 * Student REST Routes
 */

const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');

// Standard REST CRUD endpoints as requested:
// POST /studentsInsert
router.post('/studentsInsert', studentController.studentsInsert);

// GET /getStudents
router.get('/getStudents', studentController.getStudents);

// POST /studentUpdate
router.post('/studentUpdate', studentController.studentUpdate);

// POST /studentDelete
router.post('/studentDelete', studentController.studentDelete);

module.exports = router;
