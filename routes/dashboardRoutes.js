const express = require('express');
const mongoose = require('mongoose');
const Leave = require('../models/LeaveRequest');
const User = require('../models/User');
const WorkloadAssignment = require('../models/WorkloadAssignment');
const { sendLeaveNotification } = require('../config/mailer');
const router = express.Router();

// Middleware to check authentication
const requireAuth = (req, res, next) => {
    if (!req.session.user) {
        return res.redirect('/');
    }
    
    // Ensure user has an ID (either id or _id)
    if (!req.session.user.id && !req.session.user._id) {
        console.error('❌ No user ID found in session:', req.session.user);
        return res.redirect('/?error=Session error, please login again');
    }
    
    next();
};

// Helper function to get user ID from session
const getUserId = (user) => {
    return user._id || user.id;
};

// Dashboard main page
router.get('/', requireAuth, async (req, res) => {
    try {
        console.log('=== DASHBOARD LOADING ===');
        console.log('User role:', req.session.user.role);
        
        // Get user ID from session
        const userId = getUserId(req.session.user);
        console.log('User ID:', userId);

        let leaves, stats, pendingWorkloads, departmentStats, recentActivities;
        let workloadStats = {
            pendingAssignments: 0,
            approvedAssignments: 0,
            rejectedAssignments: 0,
            totalAssignments: 0
        };
        let recentAssignments = [];

        // Get current date for display
        const currentDate = new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        // Fix role check - make it case insensitive
        const userRole = req.session.user.role.toLowerCase();
        console.log('Normalized user role:', userRole);
        
        if (userRole === 'hod') {
            console.log('Loading HOD dashboard...');
            
            // HOD Dashboard Data - Get ALL leaves for approval
            const allLeaves = await Leave.find()
                .populate('faculty', 'username email department')
                .populate('workloadAssignments.faculty', 'username')
                .populate('approvedBy', 'username')
                .sort({ createdAt: -1 })
                .limit(20);

            console.log('Found leaves for HOD:', allLeaves.length);
            
            // Debug: Log all leaves with their status
            allLeaves.forEach(leave => {
                console.log(`Leave ID: ${leave._id}, Status: ${leave.status}, Faculty: ${leave.faculty?.username}`);
            });

            // Separate leaves by status for HOD - FIXED STATUS VALUES
            const pendingLeaves = allLeaves.filter(leave => leave.status === 'Pending');
            const approvedLeaves = allLeaves.filter(leave => leave.status === 'Approved');
            const rejectedLeaves = allLeaves.filter(leave => leave.status === 'Rejected');

            console.log(`Pending: ${pendingLeaves.length}, Approved: ${approvedLeaves.length}, Rejected: ${rejectedLeaves.length}`);

            // Department statistics
            const facultyCount = await User.countDocuments({ 
                department: req.session.user.department,
                role: { $regex: /faculty/i },
                isActive: true
            });

            // Count leaves for stats - FIXED STATUS VALUES
            const totalLeaves = await Leave.countDocuments();
            const pendingLeavesCount = await Leave.countDocuments({ status: 'Pending' });
            const approvedLeavesCount = await Leave.countDocuments({ status: 'Approved' });
            const rejectedLeavesCount = await Leave.countDocuments({ status: 'Rejected' });

            stats = {
                total: totalLeaves,
                pending: pendingLeavesCount,
                approved: approvedLeavesCount,
                rejected: rejectedLeavesCount,
                facultyCount,
                balance: 15,
                pendingApprovals: pendingLeavesCount
            };

            console.log('HOD Stats:', stats);

            // Get faculty leave details for HOD
            const facultyMembers = await User.find({
                department: req.session.user.department,
                role: { $regex: /faculty/i },
                isActive: true
            }).select('username email phone department');

            console.log('HOD Department:', req.session.user.department);
            console.log('Found faculty members:', facultyMembers.length);
            facultyMembers.forEach(f => console.log('Faculty:', f.username, '- Role:', f.role));

            // Calculate leave statistics for each faculty member
            const facultyLeaveDetails = await Promise.all(
                facultyMembers.map(async (faculty) => {
                    // Get all approved leaves for this faculty (current year or all time?)
                    // For now, let's get all approved leaves
                    const approvedLeaves = await Leave.find({
                        faculty: faculty._id,
                        status: 'Approved'
                    });

                    // Calculate total days taken
                    const totalDaysTaken = approvedLeaves.reduce((sum, leave) => sum + (leave.totalDays || 0), 0);

                    // Assuming annual leave balance is 15 days (as seen in the code)
                    const annualLeaveBalance = 15;
                    const remainingDays = Math.max(0, annualLeaveBalance - totalDaysTaken);

                    // Get pending leaves count
                    const pendingLeavesCount = await Leave.countDocuments({
                        faculty: faculty._id,
                        status: 'Pending'
                    });

                    return {
                        _id: faculty._id,
                        username: faculty.username,
                        email: faculty.email,
                        phone: faculty.phone,
                        department: faculty.department,
                        totalDaysTaken,
                        remainingDays,
                        pendingLeavesCount,
                        approvedLeavesCount: approvedLeaves.length
                    };
                })
            );

            console.log('Faculty leave details calculated for', facultyLeaveDetails.length, 'members');
            console.log('Sample faculty detail:', facultyLeaveDetails[0]);

            // Pass data for HOD view
            const successMsg = req.query.success || req.session.success;
            const errorMsg = req.query.error || req.session.error;
            
            // Clear session messages after use
            delete req.session.success;
            delete req.session.error;
            
            res.render('dashboard', {
                title: 'HOD Dashboard - Leave Management System',
                user: req.session.user,
                leaves: allLeaves,
                pendingLeaves: pendingLeaves,
                approvedLeaves: approvedLeaves,
                rejectedLeaves: rejectedLeaves,
                stats: stats,
                pendingWorkloads: pendingWorkloads || [],
                departmentStats: departmentStats || {},
                recentActivities: recentActivities || [],
                currentDate: currentDate,
                workloadStats: workloadStats,
                recentAssignments: recentAssignments,
                facultyLeaveDetails: facultyLeaveDetails, // Add faculty leave details
                success: successMsg,
                error: errorMsg
            });
            return;

        } else {
            console.log('Loading Faculty dashboard...');
            
            // Faculty Dashboard Data - Get user's leaves with proper population
            leaves = await Leave.find({ faculty: userId })
                .populate('approvedBy', 'username')
                .sort({ createdAt: -1 })
                .limit(8);

            console.log('Found faculty leaves:', leaves.length);
            leaves.forEach(leave => {
                console.log(`Faculty Leave - ID: ${leave._id}, Status: ${leave.status}, Updated: ${leave.updatedAt}`);
            });

            // FIXED: Get workload stats without using aggregation (simpler approach)
            try {
                const allAssignments = await WorkloadAssignment.find({ assignedTo: userId });
                
                workloadStats.totalAssignments = allAssignments.length;
                workloadStats.pendingAssignments = allAssignments.filter(a => a.status === 'pending').length;
                workloadStats.approvedAssignments = allAssignments.filter(a => a.status === 'approved').length;
                workloadStats.rejectedAssignments = allAssignments.filter(a => a.status === 'rejected').length;

                console.log('Workload Stats:', workloadStats);
            } catch (workloadError) {
                console.error('Error loading workload stats:', workloadError);
                // Use default stats if there's an error
                workloadStats = {
                    pendingAssignments: 0,
                    approvedAssignments: 0,
                    rejectedAssignments: 0,
                    totalAssignments: 0
                };
            }

            // Get recent workload assignments
            try {
                recentAssignments = await WorkloadAssignment.find({ assignedTo: userId })
                    .populate('assignedBy', 'name email')
                    .populate('leaveApplication')
                    .sort({ assignedAt: -1 })
                    .limit(5)
                    .lean();
            } catch (assignmentError) {
                console.error('Error loading recent assignments:', assignmentError);
                recentAssignments = [];
            }

            // Faculty leave statistics - FIXED STATUS VALUES
            const totalLeaves = await Leave.countDocuments({ faculty: userId });
            const pendingLeaves = await Leave.countDocuments({ 
                faculty: userId, 
                status: 'Pending' 
            });
            const approvedLeaves = await Leave.countDocuments({ 
                faculty: userId, 
                status: 'Approved' 
            });
            const rejectedLeaves = await Leave.countDocuments({ 
                faculty: userId, 
                status: 'Rejected' 
            });

            // Calculate total approved days
            const approvedLeaveDocs = await Leave.find({ 
                faculty: userId, 
                status: 'Approved' 
            });
            const totalDays = approvedLeaveDocs.reduce((sum, leave) => {
                const start = new Date(leave.startDate);
                const end = new Date(leave.endDate);
                const diffTime = Math.abs(end - start);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end dates
                return sum + diffDays;
            }, 0);

            stats = {
                total: totalLeaves,
                pending: pendingLeaves,
                approved: approvedLeaves,
                rejected: rejectedLeaves,
                totalDays: totalDays,
                balance: Math.max(0, 15 - totalDays)
            };

            console.log('Faculty Stats:', stats);

            const successMsg = req.query.success || req.session.success;
            const errorMsg = req.query.error || req.session.error;
            
            // Clear session messages after use
            delete req.session.success;
            delete req.session.error;

            res.render('dashboard', {
                title: 'Dashboard - Leave Management System',
                user: req.session.user,
                leaves: leaves || [],
                stats: stats || {},
                pendingWorkloads: pendingWorkloads || [],
                departmentStats: departmentStats || {},
                recentActivities: recentActivities || [],
                currentDate: currentDate,
                workloadStats: workloadStats,
                recentAssignments: recentAssignments,
                success: successMsg,
                error: errorMsg
            });
        }

    } catch (error) {
        console.error('Dashboard error:', error);
        
        const currentDate = new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        const defaultWorkloadStats = {
            pendingAssignments: 0,
            approvedAssignments: 0,
            rejectedAssignments: 0,
            totalAssignments: 0
        };

        // Get basic leaves data even if other parts fail
        let basicLeaves = [];
        try {
            const userId = getUserId(req.session.user);
            basicLeaves = await Leave.find({ faculty: userId })
                .populate('approvedBy', 'username')
                .sort({ createdAt: -1 })
                .limit(8);
        } catch (leavesError) {
            console.error('Error loading basic leaves:', leavesError);
        }

        res.render('dashboard', {
            title: 'Dashboard - Leave Management System',
            error: 'Failed to load some dashboard data: ' + error.message,
            user: req.session.user,
            leaves: basicLeaves,
            stats: {
                total: basicLeaves.length,
                pending: basicLeaves.filter(l => l.status === 'Pending').length,
                approved: basicLeaves.filter(l => l.status === 'Approved').length,
                rejected: basicLeaves.filter(l => l.status === 'Rejected').length,
                balance: 15,
                totalDays: 0
            },
            pendingWorkloads: [],
            departmentStats: {},
            recentActivities: [],
            currentDate: currentDate,
            workloadStats: defaultWorkloadStats,
            recentAssignments: [],
            success: req.query.success,
            error: req.query.error
        });
    }
});

// Apply Leave Page
router.get('/leave/apply', requireAuth, async (req, res) => {
    try {
        console.log('=== LOADING APPLY LEAVE PAGE ===');
        
        // Get user ID from session
        const userId = getUserId(req.session.user);
        
        // If user is faculty, get faculty members for workload assignment
        let facultyMembers = [];
        if (req.session.user.role.toLowerCase() === 'faculty') {
            facultyMembers = await User.find({ 
                department: req.session.user.department,
                role: { $regex: /faculty/i },
                _id: { $ne: userId }, // Exclude current user
                isActive: true
            }).select('username email');
        }

        res.render('leave/apply', {
            title: 'Apply for Leave - Leave Management System',
            user: req.session.user,
            facultyMembers: facultyMembers,
            success: req.query.success,
            error: req.query.error
        });

    } catch (error) {
        console.error('Apply leave page error:', error);
        res.render('leave/apply', {
            title: 'Apply for Leave - Leave Management System',
            error: 'Failed to load apply leave page: ' + error.message,
            user: req.session.user,
            facultyMembers: []
        });
    }
});

// Handle Leave Application Submission
router.post('/leave/apply', requireAuth, async (req, res) => {
    try {
        console.log('=== SUBMITTING LEAVE APPLICATION ===');
        console.log('Request body:', req.body);
        
        // Get user ID from session
        const userId = getUserId(req.session.user);
        console.log('User ID:', userId);

        const { leaveType, startDate, endDate, reason, totalDays } = req.body;

        // Validate required fields
        if (!leaveType || !startDate || !endDate || !reason) {
            return res.redirect('/leave/apply?error=All fields are required');
        }

        // Validate dates
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        if (end < start) {
            return res.redirect('/leave/apply?error=End date cannot be before start date');
        }

        // Create new leave application
        const leave = new Leave({
            faculty: userId,
            leaveType: leaveType,
            startDate: start,
            endDate: end,
            reason: reason,
            totalDays: parseInt(totalDays) || 1,
            status: 'Pending'
        });

        await leave.save();
        console.log('✅ Leave application saved successfully:', leave._id);
        console.log('Faculty assigned:', leave.faculty);

        res.redirect('/dashboard?success=Leave application submitted successfully');

    } catch (error) {
        console.error('❌ Leave application error:', error);
        res.redirect('/leave/apply?error=Failed to submit leave application: ' + error.message);
    }
});

// Leave History Page
router.get('/leave/history', requireAuth, async (req, res) => {
    try {
        // Get user ID from session
        const userId = getUserId(req.session.user);
        
        const leaves = await Leave.find({ faculty: userId })
            .populate('approvedBy', 'username')
            .sort({ createdAt: -1 });

        res.render('leave/history', {
            title: 'Leave History - Leave Management System',
            user: req.session.user,
            leaves: leaves
        });
    } catch (error) {
        console.error('Leave history error:', error);
        res.redirect('/dashboard?error=Failed to load leave history');
    }
});

// HOD Leave Approval Routes - FIXED STATUS VALUES
router.post('/leave/:id/approve', requireAuth, async (req, res) => {
    try {
        console.log('=== APPROVE LEAVE ===');
        console.log('Leave ID:', req.params.id);
        console.log('User role:', req.session.user.role);
        
        const { id } = req.params;
        
        // Check if user is HOD
        const userRole = req.session.user.role.toLowerCase();
        if (userRole !== 'hod') {
            console.log('User is not HOD, redirecting...');
            return res.redirect('/dashboard?error=Only HOD can approve leaves');
        }

        const leave = await Leave.findById(id);
        if (!leave) {
            console.log('Leave not found:', id);
            return res.redirect('/dashboard?error=Leave application not found');
        }

        console.log('Found leave:', leave._id, 'Current Status:', leave.status);

        // Update leave status - FIXED STATUS VALUE
        leave.status = 'Approved';
        leave.approvedBy = getUserId(req.session.user);
        leave.updatedAt = new Date();
        await leave.save();

        // Fetch faculty details to get email
        const faculty = await User.findById(leave.faculty);
        if (faculty && faculty.email) {
            // Send approval email
            const leaveTypeLabel = leave.leaveType.charAt(0).toUpperCase() + leave.leaveType.slice(1);
            const startDate = new Date(leave.startDate).toLocaleDateString();
            const endDate = new Date(leave.endDate).toLocaleDateString();
            
            const emailSubject = `✅ Leave Approved - ${leaveTypeLabel} Leave`;
            const emailMessage = `
                <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                    <h2 style="color: #10B981;">Leave Application Approved ✅</h2>
                    <p>Dear ${faculty.username},</p>
                    <p>Your leave application has been <strong>approved</strong>.</p>
                    
                    <div style="background-color: #f0fdf4; border-left: 4px solid #10B981; padding: 15px; margin: 20px 0;">
                        <h3 style="margin-top: 0; color: #10B981;">Leave Details:</h3>
                        <ul style="list-style: none; padding: 0;">
                            <li><strong>Leave Type:</strong> ${leaveTypeLabel}</li>
                            <li><strong>Start Date:</strong> ${startDate}</li>
                            <li><strong>End Date:</strong> ${endDate}</li>
                            <li><strong>Total Days:</strong> ${leave.totalDays}</li>
                            <li><strong>Reason:</strong> ${leave.reason}</li>
                        </ul>
                    </div>
                    
                    <p>Status: <strong style="color: #10B981;">APPROVED</strong></p>
                    <p>You can now proceed with your leave. Please ensure that all workload assignments are properly delegated or completed before your leave starts.</p>
                    
                    <p>If you have any questions, please contact the HR department.</p>
                    
                    <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
                    <p style="color: #666; font-size: 12px;">This is an automated email. Please do not reply to this email.</p>
                </div>
            `;
            
            try {
                await sendLeaveNotification(faculty.email, emailSubject, emailMessage);
                console.log(`✅ Approval email sent to ${faculty.email}`);
            } catch (emailError) {
                console.error(`❌ Failed to send approval email to ${faculty.email}:`, emailError);
            }
        }

        console.log('Leave approved successfully:', id);

        res.redirect('/dashboard?success=Leave application approved successfully');

    } catch (error) {
        console.error('Approve leave error:', error);
        res.redirect('/dashboard?error=Failed to approve leave application');
    }
});

router.post('/leave/:id/reject', requireAuth, async (req, res) => {
    try {
        console.log('=== REJECT LEAVE ===');
        console.log('Leave ID:', req.params.id);
        console.log('Rejection reason:', req.body.rejectionReason);
        
        const { id } = req.params;
        const { rejectionReason } = req.body;

        // Check if user is HOD
        const userRole = req.session.user.role.toLowerCase();
        if (userRole !== 'hod') {
            return res.redirect('/dashboard?error=Only HOD can reject leaves');
        }

        if (!rejectionReason) {
            return res.redirect('/dashboard?error=Rejection reason is required');
        }

        const leave = await Leave.findById(id);
        if (!leave) {
            return res.redirect('/dashboard?error=Leave application not found');
        }

        console.log('Found leave:', leave._id, 'Current Status:', leave.status);

        // Update leave status - FIXED STATUS VALUE
        leave.status = 'Rejected';
        leave.rejectionReason = rejectionReason;
        leave.updatedAt = new Date();
        await leave.save();

        // Fetch faculty details to get email
        const faculty = await User.findById(leave.faculty);
        if (faculty && faculty.email) {
            // Send rejection email
            const leaveTypeLabel = leave.leaveType.charAt(0).toUpperCase() + leave.leaveType.slice(1);
            const startDate = new Date(leave.startDate).toLocaleDateString();
            const endDate = new Date(leave.endDate).toLocaleDateString();
            
            const emailSubject = `❌ Leave Rejected - ${leaveTypeLabel} Leave`;
            const emailMessage = `
                <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                    <h2 style="color: #EF4444;">Leave Application Rejected ❌</h2>
                    <p>Dear ${faculty.username},</p>
                    <p>Unfortunately, your leave application has been <strong>rejected</strong>.</p>
                    
                    <div style="background-color: #fef2f2; border-left: 4px solid #EF4444; padding: 15px; margin: 20px 0;">
                        <h3 style="margin-top: 0; color: #EF4444;">Leave Details:</h3>
                        <ul style="list-style: none; padding: 0;">
                            <li><strong>Leave Type:</strong> ${leaveTypeLabel}</li>
                            <li><strong>Start Date:</strong> ${startDate}</li>
                            <li><strong>End Date:</strong> ${endDate}</li>
                            <li><strong>Total Days:</strong> ${leave.totalDays}</li>
                            <li><strong>Reason:</strong> ${leave.reason}</li>
                        </ul>
                    </div>
                    
                    <div style="background-color: #fef2f2; border-left: 4px solid #EF4444; padding: 15px; margin: 20px 0;">
                        <h3 style="margin-top: 0; color: #EF4444;">Rejection Reason:</h3>
                        <p>${rejectionReason}</p>
                    </div>
                    
                    <p>Status: <strong style="color: #EF4444;">REJECTED</strong></p>
                    <p>If you believe this is an error or would like to appeal this decision, please contact the HR department or your department head.</p>
                    
                    <p>You may reapply for leave at a later date.</p>
                    
                    <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
                    <p style="color: #666; font-size: 12px;">This is an automated email. Please do not reply to this email.</p>
                </div>
            `;
            
            try {
                await sendLeaveNotification(faculty.email, emailSubject, emailMessage);
                console.log(`✅ Rejection email sent to ${faculty.email}`);
            } catch (emailError) {
                console.error(`❌ Failed to send rejection email to ${faculty.email}:`, emailError);
            }
        }

        console.log('Leave rejected successfully:', id);

        res.redirect('/dashboard?success=Leave application rejected successfully');

    } catch (error) {
        console.error('Reject leave error:', error);
        res.redirect('/dashboard?error=Failed to reject leave application');
    }
});

// Check for last update timestamp
router.get('/last-update', requireAuth, async (req, res) => {
    try {
        // Get user ID from session
        const userId = getUserId(req.session.user);
        
        // Get the most recent update time from user's leaves
        const lastLeave = await Leave.findOne({ faculty: userId })
            .sort({ updatedAt: -1 })
            .select('updatedAt');
        
        res.json({
            lastUpdate: lastLeave ? lastLeave.updatedAt.getTime() : 0
        });
    } catch (error) {
        res.json({ lastUpdate: 0 });
    }
});

// Debug route to check session
router.get('/debug-session', requireAuth, (req, res) => {
    const userId = getUserId(req.session.user);
    
    console.log('🔍 DEBUG SESSION:', {
        sessionID: req.sessionID,
        user: req.session.user,
        userId: userId,
        has_id: !!req.session.user._id,
        hasId: !!req.session.user.id
    });
    
    res.json({
        sessionID: req.sessionID,
        user: req.session.user,
        userId: userId,
        has_id: !!req.session.user._id,
        hasId: !!req.session.user.id
    });
});

// Test route to verify faculty leaves
router.get('/test-faculty-leaves', requireAuth, async (req, res) => {
    try {
        // Get user ID from session
        const userId = getUserId(req.session.user);
        
        const facultyLeaves = await Leave.find({ faculty: userId })
            .populate('approvedBy', 'username')
            .sort({ updatedAt: -1 });

        res.json({
            facultyId: userId,
            totalLeaves: facultyLeaves.length,
            leaves: facultyLeaves.map(leave => ({
                id: leave._id,
                status: leave.status,
                leaveType: leave.leaveType,
                updatedAt: leave.updatedAt,
                approvedBy: leave.approvedBy ? leave.approvedBy.username : null,
                rejectionReason: leave.rejectionReason
            }))
        });
    } catch (error) {
        res.json({ error: error.message });
    }
});

// Debug route to check all leaves
router.get('/debug-leaves', requireAuth, async (req, res) => {
    try {
        const leaves = await Leave.find()
            .populate('faculty', 'username department')
            .populate('approvedBy', 'username')
            .sort({ createdAt: -1 });

        res.json({
            totalLeaves: leaves.length,
            leaves: leaves.map(leave => ({
                id: leave._id,
                status: leave.status,
                faculty: leave.faculty ? {
                    id: leave.faculty._id,
                    username: leave.faculty.username,
                    department: leave.faculty.department
                } : 'No faculty',
                approvedBy: leave.approvedBy ? leave.approvedBy.username : null,
                leaveType: leave.leaveType,
                startDate: leave.startDate,
                endDate: leave.endDate,
                createdAt: leave.createdAt,
                updatedAt: leave.updatedAt
            }))
        });
    } catch (error) {
        res.json({ error: error.message });
    }
});

// Test route to create a sample leave
router.get('/test-create-leave', requireAuth, async (req, res) => {
    try {
        // Get user ID from session
        const userId = getUserId(req.session.user);
        
        const testLeave = new Leave({
            faculty: userId,
            leaveType: 'Casual',
            startDate: new Date(),
            endDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
            reason: 'Test leave application for debugging',
            status: 'Pending' // Using correct status value
        });

        await testLeave.save();
        
        res.json({
            success: true,
            message: 'Test leave created successfully',
            leave: {
                id: testLeave._id,
                status: testLeave.status,
                faculty: testLeave.faculty
            }
        });
    } catch (error) {
        res.json({ error: error.message });
    }
});

// Faculty Leave Details Page - HOD Only
router.get('/faculty-leave-details', requireAuth, async (req, res) => {
    try {
        console.log('=== LOADING FACULTY LEAVE DETAILS PAGE ===');

        // Check if user is HOD
        if (req.session.user.role.toLowerCase() !== 'hod') {
            return res.redirect('/dashboard?error=Access denied. HOD privileges required.');
        }

        console.log('HOD Department:', req.session.user.department);

        // Get faculty leave details for HOD
        const facultyMembers = await User.find({
            department: req.session.user.department,
            role: { $regex: /faculty/i },
            isActive: true
        }).select('username email phone');

        console.log('Found faculty members:', facultyMembers.length);
        facultyMembers.forEach(f => console.log('Faculty:', f.username, '- Role:', f.role));

        // Calculate leave statistics for each faculty member
        const facultyLeaveDetails = await Promise.all(
            facultyMembers.map(async (faculty) => {
                // Get all approved leaves for this faculty
                const approvedLeaves = await Leave.find({
                    faculty: faculty._id,
                    status: 'Approved'
                });

                // Calculate total days taken
                const totalDaysTaken = approvedLeaves.reduce((sum, leave) => sum + (leave.totalDays || 0), 0);

                // Assuming annual leave balance is 15 days
                const annualLeaveBalance = 15;
                const remainingDays = Math.max(0, annualLeaveBalance - totalDaysTaken);

                // Get pending leaves count
                const pendingLeavesCount = await Leave.countDocuments({
                    faculty: faculty._id,
                    status: 'Pending'
                });

                return {
                    _id: faculty._id,
                    username: faculty.username,
                    email: faculty.email,
                    phone: faculty.phone,
                    totalDaysTaken,
                    remainingDays,
                    pendingLeavesCount,
                    approvedLeavesCount: approvedLeaves.length
                };
            })
        );

        console.log('Faculty leave details calculated for', facultyLeaveDetails.length, 'members');

        // Get current date for display
        const currentDate = new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        res.render('faculty-leave-details', {
            title: 'Faculty Leave Details - Leave Management System',
            user: req.session.user,
            facultyLeaveDetails: facultyLeaveDetails,
            currentDate: currentDate,
            success: req.query.success,
            error: req.query.error
        });

    } catch (error) {
        console.error('Faculty leave details page error:', error);
        res.redirect('/dashboard?error=Failed to load faculty leave details: ' + error.message);
    }
});

// User Profile Page
router.get('/profile', requireAuth, async (req, res) => {
    try {
        // Session already has user data
        res.render('profile', {
            title: 'User Profile - Leave Management System',
            user: req.session.user
        });
    } catch (error) {
        console.error('Profile page error:', error);
        res.redirect('/dashboard?error=Failed to load profile page');
    }
});

module.exports = router;