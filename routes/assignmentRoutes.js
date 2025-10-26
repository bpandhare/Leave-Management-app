// routes/assignmentRoutes.js
const express = require('express');
const router = express.Router();
const { assignWorkload, getLeaveApplicationsForAssignment } = require('../controllers/assignmentController');
const auth = require('../middleware/auth');

// HOD routes for workload assignment
router.get('/hod/leave-applications', auth, getLeaveApplicationsForAssignment);
router.post('/hod/assign-workload', auth, assignWorkload);

// Render HOD assignment page
router.get('/hod/assign-workload', auth, (req, res) => {
    if (req.user.role !== 'hod') {
        return res.status(403).render('error', {
            title: 'Access Denied',
            message: 'Only HOD can access this page.'
        });
    }
    
    res.render('leave/assign-workload', {
        title: 'Assign Workload - LeaveManager',
        user: req.user
    });
});
module.exports = router;