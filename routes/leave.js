const express = require('express');
const Leave = require('../models/LeaveRequest');
const User = require('../models/User');
const WorkloadAssignment = require('../models/WorkloadAssignment');
const { sendLeaveNotification } = require('../config/mailer');
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
        
        if (req.session.user.role.toLowerCase() !== 'faculty') {
            console.log('📍 User is not faculty, redirecting to dashboard');
            req.session.error = 'Only faculty members can apply for leave';
            return res.redirect('/dashboard');
        }
        
        console.log('📍 Rendering apply-leave page');

        const facultyMembers = await User.find({
            role: { $regex: /^faculty$/i },
            department: req.session.user.department,
            _id: { $ne: req.session.user._id }
        }).select('username email department');

        const success = req.session.success;
        const error = req.session.error;
        // Clear the messages after displaying
        delete req.session.success;
        delete req.session.error;
        
        res.render('leave/apply-leave', {
            title: 'Apply for Leave',
            user: req.session.user,
            facultyMembers,
            success: success,
            error: error
        });
        
    } catch (error) {
        console.error('❌ Error in /leave/apply:', error);
        req.session.error = 'Failed to load apply leave page';
        res.redirect('/dashboard');
    }
});

// Handle Leave Application Submission - POST
router.post('/apply', async (req, res) => {
    try {
        console.log('📍 /leave/apply POST route hit');
        const { leaveType, startDate, endDate, reason } = req.body;
        
        console.log('📍 Form data received:', { leaveType, startDate, endDate, reason });

        // Validate required fields
        if (!leaveType || !startDate || !endDate || !reason) {
            req.session.error = 'All fields are required';
            return res.redirect('/leave/apply');
        }

        // Validate dates
        const start = new Date(startDate);
        const end = new Date(endDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (start < today) {
            req.session.error = 'Start date cannot be in the past';
            return res.redirect('/leave/apply');
        }

        if (end < start) {
            req.session.error = 'End date must be after start date';
            return res.redirect('/leave/apply');
        }

        // Create leave application
        const leaveApplication = new Leave({
            faculty: req.session.user._id,
            leaveType: leaveType.charAt(0).toUpperCase() + leaveType.slice(1).toLowerCase(),
            startDate: start,
            endDate: end,
            reason: reason.trim()
        });

        // Workload delegation fields (optional)
        const { assignedFaculty, assignmentSubject, assignmentDate, assignmentTimeSlot, assignmentDetails } = req.body;
        const workloadAssignments = [];

        if (assignedFaculty) {
            if (!assignmentSubject || !assignmentDate || !assignmentTimeSlot) {
                req.session.error = 'When assigning workload, faculty, subject, date, and time slot are all required.';
                return res.redirect('/leave/apply');
            }

            workloadAssignments.push({
                faculty: assignedFaculty,
                subject: assignmentSubject.trim(),
                date: new Date(assignmentDate),
                timeSlot: assignmentTimeSlot.trim(),
                details: assignmentDetails ? assignmentDetails.trim() : undefined,
                status: 'Pending'
            });
        } else if (assignmentSubject || assignmentDate || assignmentTimeSlot || assignmentDetails) {
            req.session.error = 'To assign a workload, please select a faculty member first.';
            return res.redirect('/leave/apply');
        }

        if (workloadAssignments.length > 0) {
            leaveApplication.workloadAssignments = workloadAssignments;
        }

        await leaveApplication.save();
        console.log('✅ Leave application created:', leaveApplication._id);

        if (workloadAssignments.length > 0) {
            const newAssignment = new WorkloadAssignment({
                leaveApplication: leaveApplication._id,
                leaveApplicationModel: 'Leave',
                assignedTo: assignedFaculty,
                assignedBy: req.session.user._id,
                subjects: [assignmentSubject.trim()],
                classes: assignmentTimeSlot ? [assignmentTimeSlot.trim()] : [],
                totalHours: 0,
                date: new Date(assignmentDate),
                timeSlot: assignmentTimeSlot.trim(),
                notes: assignmentDetails ? assignmentDetails.trim() : undefined
            });
            await newAssignment.save();
            console.log('✅ Workload assignment created for faculty:', assignedFaculty);
        }

        // Find HOD(s) for the faculty's department
        const hods = await User.find({
            department: req.session.user.department,
            role: { $regex: /hod/i }, // Case insensitive search for HOD
            isActive: true
        });

        console.log(`📧 Found ${hods.length} HOD(s) for department ${req.session.user.department}`);

        // Send notification email to HOD(s)
        if (hods.length > 0) {
            const leaveTypeLabel = leaveApplication.leaveType.charAt(0).toUpperCase() + leaveApplication.leaveType.slice(1);
            const formattedStartDate = start.toLocaleDateString();
            const formattedEndDate = end.toLocaleDateString();

            const hodEmails = hods.map(hod => hod.email);
            const emailSubject = `🔔 New Leave Application - ${leaveTypeLabel} Leave`;

            const emailMessage = `
                <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                    <h2 style="color: #3B82F6;">New Leave Application Submitted</h2>
                    <p>Dear HOD,</p>
                    <p>A new leave application has been submitted in your department and requires your approval.</p>
                    
                    <div style="background-color: #f0f9ff; border-left: 4px solid #3B82F6; padding: 15px; margin: 20px 0;">
                        <h3 style="margin-top: 0; color: #3B82F6;">Application Details:</h3>
                        <ul style="list-style: none; padding: 0;">
                            <li><strong>Faculty:</strong> ${req.session.user.username}</li>
                            <li><strong>Department:</strong> ${req.session.user.department}</li>
                            <li><strong>Leave Type:</strong> ${leaveTypeLabel}</li>
                            <li><strong>Start Date:</strong> ${formattedStartDate}</li>
                            <li><strong>End Date:</strong> ${formattedEndDate}</li>
                            <li><strong>Total Days:</strong> ${leaveApplication.totalDays}</li>
                            <li><strong>Reason:</strong> ${leaveApplication.reason}</li>
                        </ul>
                    </div>
                    
                    <p>Please review this application and take appropriate action (approve or reject) through the Leave Management System.</p>
                    
                    <div style="background-color: #fef3c7; border-left: 4px solid #F59E0B; padding: 15px; margin: 20px 0;">
                        <h4 style="margin-top: 0; color: #F59E0B;">Action Required:</h4>
                        <p>Log in to the system and navigate to the dashboard to review pending leave applications.</p>
                    </div>
                    
                    <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
                    <p style="color: #666; font-size: 12px;">This is an automated notification from the Leave Management System.</p>
                </div>
            `;

            try {
                await sendLeaveNotification(hodEmails.join(','), emailSubject, emailMessage);
                console.log(`✅ Notification email sent to HOD(s): ${hodEmails.join(', ')}`);
            } catch (emailError) {
                console.error(`❌ Failed to send notification email to HOD(s):`, emailError);
                // Don't fail the application if email fails
            }
        } else {
            console.warn(`⚠️  No HOD found for department: ${req.session.user.department}`);
        }

        req.session.success = 'Leave application submitted successfully! Notification sent to HOD.';
        res.redirect('/dashboard');
        
    } catch (error) {
        console.error('❌ Error submitting leave:', error);
        req.session.error = 'Failed to submit leave application';
        res.redirect('/leave/apply');
    }
});

// Leave History Page
router.get('/history', async (req, res) => {
    try {
        console.log('📍 /leave/history route hit');
        
        if (!req.session.user) {
            console.log('📍 No user session, redirecting to login');
            return res.redirect('/auth/login');
        }

        // Fetch user's leave applications
        const leaves = await Leave.find({ faculty: req.session.user._id })
            .sort({ createdAt: -1 }) // Most recent first
            .populate('approvedBy', 'username'); // Populate approver info

        console.log(`📍 Found ${leaves.length} leave applications for user ${req.session.user.username}`);

        res.render('leave/history', {
            title: 'Leave History',
            user: req.session.user,
            leaves: leaves
        });
    } catch (error) {
        console.error('❌ Error in /leave/history:', error);
        res.redirect('/dashboard');
    }
});

// Leave Applications Page - For HOD to review all applications
router.get('/applications', async (req, res) => {
    try {
        console.log('📍 /leave/applications route hit');
        
        if (!req.session.user) {
            console.log('📍 No user session, redirecting to login');
            return res.redirect('/auth/login');
        }

        // Check if user is HOD
        if (req.session.user.role.toLowerCase() !== 'hod') {
            console.log('📍 User is not HOD, redirecting to dashboard');
            req.session.error = 'Only HODs can view leave applications';
            return res.redirect('/dashboard');
        }

        // Fetch ALL leave applications (all statuses) to display complete data, populate faculty info
        const leaves = await Leave.find({})
        .populate('faculty', 'username email department')
        .populate('approvedBy', 'username')
        .populate('workloadAssignments')
        .sort({ createdAt: -1 });

        console.log(`📍 Found ${leaves.length} total leave applications (all statuses)`);
        
        // Log breakdown
        const pending = leaves.filter(l => l.status === 'Pending').length;
        const approved = leaves.filter(l => l.status === 'Approved').length;
        const rejected = leaves.filter(l => l.status === 'Rejected').length;
        console.log(`📊 Status breakdown - Pending: ${pending}, Approved: ${approved}, Rejected: ${rejected}`);

        const success = req.session.success;
        const error = req.session.error;
        // Clear the messages after displaying
        delete req.session.success;
        delete req.session.error;

        res.render('leave/applications', {
            title: 'Leave Applications',
            user: req.session.user,
            leaves: leaves,
            success: success,
            error: error
        });
    } catch (error) {
        console.error('❌ Error in /leave/applications:', error);
        req.session.error = 'Failed to load leave applications';
        res.redirect('/dashboard');
    }
});

// Test route to check database data (for debugging)
router.get('/test', async (req, res) => {
    try {
        const totalLeaves = await Leave.countDocuments();
        const pendingLeaves = await Leave.countDocuments({ status: 'Pending' });
        const approvedLeaves = await Leave.countDocuments({ status: 'Approved' });
        const rejectedLeaves = await Leave.countDocuments({ status: 'Rejected' });
        
        res.json({ 
            message: 'Leave routes are working!',
            database: {
                total: totalLeaves,
                pending: pendingLeaves,
                approved: approvedLeaves,
                rejected: rejectedLeaves
            },
            routes: [
                '/leave/apply (GET/POST) - Apply for leave',
                '/leave/history (GET) - View leave history',
                '/leave/applications (GET) - View all applications (HOD only)',
                '/leave/test (GET) - Check database data'
            ]
        });
    } catch (error) {
        res.status(500).json({ 
            error: error.message,
            message: 'Error checking database'
        });
    }
});

module.exports = router;