// routes/workload.js
const express = require('express');
const router = express.Router();
const { getWorkloadAssignments, approveWorkload, rejectWorkload } = require('../controllers/workloadController');
const auth = require('../middleware/auth');

// All routes are protected with auth middleware
router.get('/faculty/workload-assignments', auth, getWorkloadAssignments);
router.post('/faculty/workload-assignments/:id/approve', auth, approveWorkload);
router.post('/faculty/workload-assignments/:id/reject', auth, rejectWorkload);

module.exports = router;