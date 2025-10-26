const express = require('express');
const Leave = require('../models/LeaveRequest');
const User = require('../models/User');
const WorkloadAssignment = require('../models/WorkloadAssignment');
const router = express.Router();

// Middleware to check authentication
const requireAuth = (req, res, next) => {
    if (!req.session.user) {
        return res.redirect('/auth/login');
    }
    next();
};

// Dashboard main page
router.get('/', requireAuth, async (req, res) => {
    try {
        console.log('=== DASHBOARD LOADING ===');
        console.log('User role:', req.session.user.role);
        console.log('User ID:', req.session.user._id);
        console.log('User department:', req.session.user.department);

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
            
            // HOD Dashboard Data - Get ALL pending leaves for approval
            const allLeaves = await Leave.find({ status: 'pending' })
                .populate('faculty', 'username email department')
                .sort({ createdAt: -1 });

            console.log('Found pending leaves for HOD:', allLeaves.length);

            // Get department-specific leaves (if you want to filter by department)
            const departmentLeaves = allLeaves.filter(leave => 
                leave.faculty && leave.faculty.department === req.session.user.department
            );

            console.log('Department leaves:', departmentLeaves.length);

            // Use all leaves or department leaves based on your requirement
            leaves = allLeaves; // Change to departmentLeaves if you want department-specific

            // Get approved and rejected leaves for display
            const approvedLeaves = await Leave.find({ status: 'approved' })
                .populate('faculty', 'username email department')
                .sort({ updatedAt: -1 })
                .limit(5);

            const rejectedLeaves = await Leave.find({ status: 'rejected' })
                .populate('faculty', 'username email department')
                .sort({ updatedAt: -1 })
                .limit(5);

            // Department statistics
            const facultyCount = await User.countDocuments({ 
                department: req.session.user.department,
                role: { $regex: /faculty/i },
                isActive: true
            });

            // Count leaves for stats
            const totalLeaves = await Leave.countDocuments();
            const pendingLeavesCount = await Leave.countDocuments({ status: 'pending' });
            const approvedLeavesCount = await Leave.countDocuments({ status: 'approved' });
            const rejectedLeavesCount = await Leave.countDocuments({ status: 'rejected' });

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

            // Pass data for HOD view
            res.render('dashboard', {
                title: 'HOD Dashboard - Leave Management System',
                user: req.session.user,
                leaves: leaves, // All pending leaves
                pendingLeaves: leaves, // Same as leaves for HOD
                approvedLeaves: approvedLeaves,
                rejectedLeaves: rejectedLeaves,
                stats: stats,
                pendingWorkloads: pendingWorkloads || [],
                departmentStats: departmentStats || {},
                recentActivities: recentActivities || [],
                currentDate: currentDate,
                workloadStats: workloadStats,
                recentAssignments: recentAssignments,
                success: req.query.success,
                error: req.query.error
            });
            return;

        } else {
            console.log('Loading Faculty dashboard...');
            
            // Faculty Dashboard Data - Get user's leaves
            leaves = await Leave.find({ faculty: req.session.user._id })
                .sort({ createdAt: -1 })
                .limit(6);

            console.log('Found faculty leaves:', leaves.length);

            // Faculty leave statistics
            const totalLeaves = await Leave.countDocuments({ faculty: req.session.user._id });
            const pendingLeaves = await Leave.countDocuments({ 
                faculty: req.session.user._id, 
                status: 'pending' 
            });
            const approvedLeaves = await Leave.countDocuments({ 
                faculty: req.session.user._id, 
                status: 'approved' 
            });
            const rejectedLeaves = await Leave.countDocuments({ 
                faculty: req.session.user._id, 
                status: 'rejected' 
            });

            stats = {
                total: totalLeaves,
                pending: pendingLeaves,
                approved: approvedLeaves,
                rejected: rejectedLeaves,
                balance: 15
            };

            console.log('Faculty Stats:', stats);

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
                success: req.query.success,
                error: req.query.error
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

        res.render('dashboard', {
            title: 'Dashboard - Leave Management System',
            error: 'Failed to load dashboard data: ' + error.message,
            user: req.session.user,
            leaves: [],
            stats: {
                total: 0,
                pending: 0,
                approved: 0,
                rejected: 0,
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

// HOD Leave Approval Routes
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

        console.log('Found leave:', leave._id, 'Status:', leave.status, 'Faculty:', leave.faculty);

        // Update leave status
        leave.status = 'approved';
        leave.updatedAt = new Date();
        await leave.save();

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

        console.log('Found leave:', leave._id, 'Status:', leave.status, 'Faculty:', leave.faculty);

        // Update leave status
        leave.status = 'rejected';
        leave.rejectionReason = rejectionReason;
        leave.updatedAt = new Date();
        await leave.save();

        console.log('Leave rejected successfully:', id);

        res.redirect('/dashboard?success=Leave application rejected successfully');

    } catch (error) {
        console.error('Reject leave error:', error);
        res.redirect('/dashboard?error=Failed to reject leave application');
    }
});

// Debug route to check all leaves
router.get('/debug-leaves', requireAuth, async (req, res) => {
    try {
        const leaves = await Leave.find()
            .populate('faculty', 'username department')
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
                leaveType: leave.leaveType,
                startDate: leave.startDate,
                endDate: leave.endDate,
                createdAt: leave.createdAt
            }))
        });
    } catch (error) {
        res.json({ error: error.message });
    }
});

module.exports = router;