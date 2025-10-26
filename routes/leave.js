const express = require('express');
const Leave = require('../models/Leave');
const router = express.Router();

// Debug middleware for leave routes
router.use((req, res, next) => {
    console.log(`📍 LEAVE ROUTE: ${req.method} ${req.originalUrl}`);
    next();
});

// Apply Leave Page - GET
router.get('/apply', async (req, res) => {
    try {
        console.log('📍 /leave/apply GET route hit');
        console.log('📍 User:', req.session.user?.username);
        
        if (!req.session.user) {
            console.log('📍 No user session, redirecting to login');
            return res.redirect('/auth/login');
        }
        
        // Check if user is faculty
        if (req.session.user.role.toLowerCase() !== 'faculty') {
            console.log('📍 User is not faculty, redirecting to dashboard');
            req.flash('error', 'Only faculty members can apply for leave');
            return res.redirect('/dashboard');
        }
        
        console.log('📍 Rendering apply-leave page');
        res.render('apply-leave', {
            title: 'Apply for Leave',
            user: req.session.user,
            success: req.flash('success'),
            error: req.flash('error')
        });
        
    } catch (error) {
        console.error('❌ Error in /leave/apply:', error);
        req.flash('error', 'Failed to load apply leave page');
        res.redirect('/dashboard');
    }
});

// Handle Leave Application Submission - POST
router.post('/apply', async (req, res) => {
    try {
        console.log('📍 /leave/apply POST route hit');
        const { leaveType, startDate, endDate, reason } = req.body;
        
        console.log('📍 Form data received:', { leaveType, startDate, endDate, reason });

        // Validate and process leave application...
        // Your existing leave application logic here
        
        req.flash('success', 'Leave application submitted successfully!');
        res.redirect('/dashboard');
        
    } catch (error) {
        console.error('❌ Error submitting leave:', error);
        req.flash('error', 'Failed to submit leave application');
        res.redirect('/leave/apply');
    }
});

// Leave History Page
router.get('/history', async (req, res) => {
    try {
        console.log('📍 /leave/history route hit');
        res.render('leave-history', {
            title: 'Leave History',
            user: req.session.user
        });
    } catch (error) {
        console.error('❌ Error in /leave/history:', error);
        res.redirect('/dashboard');
    }
});

// Test route
router.get('/test', (req, res) => {
    res.json({ 
        message: 'Leave routes are working!',
        route: '/leave/apply should be available'
    });
});

module.exports = router;