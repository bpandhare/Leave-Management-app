const express = require('express');
const Leave = require('../models/LeaveRequest');
const User = require('../models/User');
const WorkloadAssignment = require('../models/WorkloadAssignment');
const { sendLeaveNotification } = require('../config/mailer');
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
            const allLeaves = await Leave.find({ status: 'Pending' })
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
            const approvedLeaves = await Leave.find({ status: 'Approved' })
                .populate('faculty', 'username email department')
                .sort({ updatedAt: -1 })
                .limit(5);

            const rejectedLeaves = await Leave.find({ status: 'Rejected' })
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
            }).select('username email phone');

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
                facultyLeaveDetails: facultyLeaveDetails, // Add faculty leave details
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
                status: 'Pending' 
            });
            const approvedLeaves = await Leave.countDocuments({ 
                faculty: req.session.user._id, 
                status: 'Approved' 
            });
            const rejectedLeaves = await Leave.countDocuments({ 
                faculty: req.session.user._id, 
                status: 'Rejected' 
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

// HOD Leave Action Route (generic approve/reject handler)
router.post('/:id/action', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { status, comments } = req.body;

        console.log('=== LEAVE ACTION ===');
        console.log('Leave ID:', id);
        console.log('Action:', status);
        console.log('User role:', req.session.user.role);

        // Check if user is HOD
        const userRole = (req.session.user.role || '').toLowerCase();
        if (userRole !== 'hod') {
            return res.redirect('/dashboard?error=Only HOD can update leave status');
        }

        const leave = await Leave.findById(id);
        if (!leave) {
            return res.redirect('/dashboard?error=Leave application not found');
        }

        if (leave.status !== 'Pending') {
            return res.redirect('/dashboard?error=Leave is not pending');
        }

        const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
        const isEscalationAllowed = (new Date().getTime() - new Date(leave.createdAt).getTime()) >= TWENTY_FOUR_HOURS_MS;
        const sessionUserId = req.session.user._id ? req.session.user._id.toString() : String(req.session.user.id || req.session.user._id);
        const assignedHodId = leave.hod ? leave.hod.toString() : null;

        if (assignedHodId && assignedHodId !== sessionUserId && !isEscalationAllowed) {
            return res.redirect('/dashboard?error=Only the assigned HOD can act within 2 days');
        }

        const emailSubjectPrefix = status === 'Approved' ? '✅ Leave Approved' : '❌ Leave Rejected';
        const leaveTypeLabel = leave.leaveType.charAt(0).toUpperCase() + leave.leaveType.slice(1);
        const startDate = new Date(leave.startDate).toLocaleDateString();
        const endDate = new Date(leave.endDate).toLocaleDateString();
        const faculty = await User.findById(leave.faculty);

        if (status === 'Approved') {
            leave.status = 'Approved';
            leave.approvedBy = req.session.user._id;
            if (comments) leave.comments = comments;
            leave.updatedAt = new Date();
            await leave.save();

            if (faculty && faculty.email) {
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
                        <p>Please ensure workload assignments are completed before your leave begins.</p>
                    </div>
                `;
                try {
                    await sendLeaveNotification(faculty.email, `${emailSubjectPrefix} - ${leaveTypeLabel} Leave`, emailMessage);
                } catch (emailError) {
                    console.error('Approval email failure:', emailError);
                }
            }

            return res.redirect('/dashboard?success=Leave application approved successfully');
        }

        if (status === 'Rejected') {
            leave.status = 'Rejected';
            leave.rejectionReason = comments || 'Rejected by HOD';
            leave.comments = comments || 'Rejected by HOD';
            leave.approvedBy = req.session.user._id;
            leave.updatedAt = new Date();
            await leave.save();

            if (faculty && faculty.email) {
                const emailMessage = `
                    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                        <h2 style="color: #EF4444;">Leave Application Rejected ❌</h2>
                        <p>Dear ${faculty.username},</p>
                        <p>Your leave application has been <strong>rejected</strong>.</p>
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
                            <p>${leave.rejectionReason}</p>
                        </div>
                        <p>Status: <strong style="color: #EF4444;">REJECTED</strong></p>
                    </div>
                `;
                try {
                    await sendLeaveNotification(faculty.email, `${emailSubjectPrefix} - ${leaveTypeLabel} Leave`, emailMessage);
                } catch (emailError) {
                    console.error('Rejection email failure:', emailError);
                }
            }

            return res.redirect('/dashboard?success=Leave application rejected successfully');
        }

        return res.redirect('/dashboard?error=Invalid leave action');
    } catch (error) {
        console.error('Leave action error:', error);
        return res.redirect('/dashboard?error=Failed to process leave action');
    }
});

// HOD Leave Approval Routes
router.post('/:id/approve', requireAuth, async (req, res) => {
    try {
        console.log('=== APPROVE LEAVE ===');
        console.log('Leave ID:', req.params.id);
        console.log('User role:', req.session.user.role);
        
        const { id } = req.params;
        
        // Check if user is HOD
        const userRole = (req.session.user.role || '').toLowerCase();
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

        // Only allow approving if pending
        if (leave.status !== 'Pending') {
            return res.redirect('/dashboard?error=Leave is not pending');
        }

        // Allow approval if current HOD is the assigned HOD (if any)
        // or if the application has been pending for 24 hours or more (escalation)
        const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
        const isEscalationAllowed = (new Date().getTime() - new Date(leave.createdAt).getTime()) >= TWENTY_FOUR_HOURS_MS;

        const sessionUserId = req.session.user._id ? req.session.user._id.toString() : String(req.session.user.id || req.session.user._id);
        const assignedHodId = leave.hod ? leave.hod.toString() : null;

        if (assignedHodId && assignedHodId !== sessionUserId && !isEscalationAllowed) {
            return res.redirect('/dashboard?error=Only the assigned HOD can approve within 2 days');
        }

        // Update leave status and record approver
        leave.status = 'Approved';
        leave.approvedBy = req.session.user._id;
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

        console.log('Leave approved successfully:', id, 'by', sessionUserId);

        res.redirect('/dashboard?success=Leave application approved successfully');

    } catch (error) {
        console.error('Approve leave error:', error);
        res.redirect('/dashboard?error=Failed to approve leave application');
    }
});

router.post('/:id/reject', requireAuth, async (req, res) => {
    try {
        console.log('=== REJECT LEAVE ===');
        console.log('Leave ID:', req.params.id);
        console.log('Rejection reason:', req.body.rejectionReason);
        
        const { id } = req.params;
        const { rejectionReason } = req.body;

        // Check if user is HOD
        const userRole = (req.session.user.role || '').toLowerCase();
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

        // Only allow rejecting if pending
        if (leave.status !== 'Pending') {
            return res.redirect('/dashboard?error=Leave is not pending');
        }

        // Allow rejection if current HOD is the assigned HOD (if any)
        // or if the application has been pending for 24 hours or more (escalation)
        const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
        const isEscalationAllowed = (new Date().getTime() - new Date(leave.createdAt).getTime()) >= TWENTY_FOUR_HOURS_MS;

        const sessionUserId = req.session.user._id ? req.session.user._id.toString() : String(req.session.user.id || req.session.user._id);
        const assignedHodId = leave.hod ? leave.hod.toString() : null;

        if (assignedHodId && assignedHodId !== sessionUserId && !isEscalationAllowed) {
            return res.redirect('/dashboard?error=Only the assigned HOD can reject within 2 days');
        }

        // Update leave status and record rejecting HOD
        leave.status = 'Rejected';
        leave.rejectionReason = rejectionReason;
        leave.comments = rejectionReason; // for backward compatibility
        leave.approvedBy = req.session.user._id;
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

        console.log('Leave rejected successfully:', id, 'by', sessionUserId);

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

// Faculty Leave History Route - For HOD to view specific faculty member's leave history
router.get('/faculty/:id/history', requireAuth, async (req, res) => {
    try {
        const facultyId = req.params.id;
        
        // Check if user is HOD
        const userRole = (req.session.user.role || '').toLowerCase();
        if (userRole !== 'hod') {
            return res.redirect('/dashboard?error=Only HOD can view faculty leave history');
        }

        // Get faculty details
        const faculty = await User.findById(facultyId);
        if (!faculty) {
            return res.redirect('/dashboard?error=Faculty member not found');
        }

        // Verify faculty is in the same department as HOD
        if (faculty.department !== req.session.user.department) {
            return res.redirect('/dashboard?error=You can only view leave history for faculty in your department');
        }

        // Get all leaves for this faculty
        const leaves = await Leave.find({ faculty: facultyId })
            .populate('approvedBy', 'username')
            .sort({ createdAt: -1 });

        // Calculate leave statistics
        const totalLeaves = leaves.length;
        const pendingLeaves = leaves.filter(l => l.status === 'Pending').length;
        const approvedLeaves = leaves.filter(l => l.status === 'Approved').length;
        const rejectedLeaves = leaves.filter(l => l.status === 'Rejected').length;
        const totalDaysTaken = leaves
            .filter(l => l.status === 'Approved')
            .reduce((sum, leave) => sum + (leave.totalDays || 0), 0);
        const remainingDays = Math.max(0, 15 - totalDaysTaken); // Assuming 15 days annual leave

        res.render('faculty-leave-history', {
            title: `${faculty.username}'s Leave History`,
            user: req.session.user,
            faculty: faculty,
            leaves: leaves,
            stats: {
                total: totalLeaves,
                pending: pendingLeaves,
                approved: approvedLeaves,
                rejected: rejectedLeaves,
                totalDaysTaken: totalDaysTaken,
                remainingDays: remainingDays,
                balance: 15
            },
            success: req.query.success,
            error: req.query.error
        });

    } catch (error) {
        console.error('Faculty leave history error:', error);
        res.redirect('/dashboard?error=Failed to load faculty leave history');
    }
});

module.exports = router;