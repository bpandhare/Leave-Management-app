const express = require('express');
const router = express.Router();
const timetableController = require('../controllers/timetableController');

// Middleware to check authentication
const requireAuth = (req, res, next) => {
    if (!req.session.user) {
        return res.redirect('/auth/login');
    }
    next();
};

// Middleware to check if user is Faculty
const requireFaculty = (req, res, next) => {
    if (!req.session.user) {
        return res.redirect('/auth/login');
    }
    if (req.session.user.role.toLowerCase() !== 'faculty') {
        return res.status(403).render('error', {
            error: 'Access denied. Faculty access required.',
            user: req.session.user
        });
    }
    next();
};

// Middleware to check if user is HOD
const requireHOD = (req, res, next) => {
    if (!req.session.user) {
        return res.redirect('/auth/login');
    }
    if (req.session.user.role.toLowerCase() !== 'hod') {
        return res.status(403).render('error', {
            error: 'Access denied. HOD access required.',
            user: req.session.user
        });
    }
    next();
};

// Faculty Routes
// Display faculty timetable page
router.get('/faculty', requireAuth, requireFaculty, (req, res) => {
    try {
        res.render('leave/faculty-timetable', {
            title: 'My Timetables - Leave Management System',
            user: req.session.user,
            success: req.session.success,
            error: req.session.error
        });
    } catch (error) {
        console.error('Error rendering faculty timetable page:', error);
        res.render('error', {
            error: 'Error loading timetable page: ' + error.message,
            user: req.session.user
        });
    }
});

// API: Get faculty's own timetables (JSON)
router.get('/api/my-timetables', requireAuth, requireFaculty, timetableController.getFacultyTimetables);

// Upload new timetable
router.post('/upload', requireAuth, requireFaculty, timetableController.uploadTimetable);

// View single timetable
router.get('/view/:id', requireAuth, timetableController.viewTimetable);

// Download timetable file
router.get('/download/:id', requireAuth, timetableController.downloadTimetable);

// Delete timetable
router.delete('/delete/:id', requireAuth, timetableController.deleteTimetable);

// HOD Routes
// Display HOD timetable page
router.get('/hod', requireAuth, requireHOD, (req, res) => {
    try {
        res.render('leave/hod-timetables', {
            title: 'Faculty Timetables - Leave Management System',
            user: req.session.user,
            success: req.session.success,
            error: req.session.error
        });
    } catch (error) {
        console.error('Error rendering HOD timetable page:', error);
        res.render('error', {
            error: 'Error loading timetable page: ' + error.message,
            user: req.session.user
        });
    }
});

// API: Get all faculty timetables in department (JSON)
router.get('/api/hod/all-faculty-timetables', requireAuth, requireHOD, timetableController.getAllFacultyTimetables);

// API: Get specific faculty's timetables (JSON)
router.get('/api/hod/faculty/:facultyId', requireAuth, requireHOD, timetableController.getFacultyTimetablesForHOD);

module.exports = router;
