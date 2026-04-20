// routes/workloadRoutes.js
const express = require('express');
const router = express.Router();
const { getWorkloadAssignments, approveWorkload, rejectWorkload } = require('../controllers/workloadController');
const { auth } = require('../middleware/auth');

// Render workload assignments page
router.get('/faculty/workload', auth, (req, res) => {
    const userRole = (req.user?.role || req.session?.user?.role || '').toLowerCase();
    
    if (userRole !== 'faculty') {
        return res.status(403).render('error', {
            title: 'Access Denied',
            message: 'Only faculty members can access workload assignments.'
        });
    }
    
    res.render('leave/workload-assignments', {
        title: 'Workload Assignments - Leave Management System',
        user: req.user || req.session.user,
        assignments: [],
        pendingCount: 0
    });
});

// API routes
router.get('/faculty/workload-assignments', auth, getWorkloadAssignments);
router.post('/faculty/workload-assignments/:id/approve', auth, approveWorkload);
router.post('/faculty/workload-assignments/:id/reject', auth, rejectWorkload);

module.exports = router;