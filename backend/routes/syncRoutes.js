/**
 * Sync REST Routes for Push & Pull Synchronization
 */

const express = require('express');
const router = express.Router();
const syncController = require('../controllers/syncController');

// POST /api/sync/push - Client sends dirty/pending local records
router.post('/push', syncController.syncPush);

// GET /api/sync/pull - Client requests changed records newer than cursor
router.get('/pull', syncController.syncPull);

module.exports = router;
