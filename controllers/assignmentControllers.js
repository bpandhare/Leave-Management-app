// controllers/assignmentController.js
const LeaveApplication = require('../models/LeaveApplication');
const WorkloadAssignment = require('../models/WorkloadAssignment');
const User = require('../models/User');

// HOD: Assign workload to faculty members
const assignWorkload = async (req, res) => {
    try {
        const { leaveApplicationId, assignedTo, subjects, classes, totalHours } = req.body;
        const assignedBy = req.user._id;

        // Check if user is HOD
        if (req.user.role !== 'hod') {
            return res.status(403).json({
                success: false,
                message: 'Only HOD can assign workload'
            });
        }

        // Create workload assignment
        const assignment = new WorkloadAssignment({
            leaveApplication: leaveApplicationId,
            assignedTo,
            assignedBy,
            subjects,
            classes,
            totalHours
        });

        await assignment.save();

        // Populate the assignment for response
        await assignment.populate('assignedTo', 'name email');
        await assignment.populate('assignedBy', 'name email');
        await assignment.populate('leaveApplication');

        res.json({
            success: true,
            message: 'Workload assigned successfully',
            assignment
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// HOD: Get leave applications needing workload assignment
const getLeaveApplicationsForAssignment = async (req, res) => {
    try {
        if (req.user.role !== 'hod') {
            return res.status(403).json({
                success: false,
                message: 'Only HOD can access this'
            });
        }

        const leaveApplications = await LeaveApplication.find({
            status: 'approved', // Only approved leaves need workload assignment
            faculty: { $ne: req.user._id } // Exclude HOD's own leaves
        })
        .populate('faculty', 'name email department')
        .sort({ createdAt: -1 });

        // Get faculty members in the same department
        const facultyMembers = await User.find({
            role: 'faculty',
            department: req.user.department,
            _id: { $ne: req.user._id } // Exclude HOD
        }).select('name email');

        res.json({
            success: true,
            leaveApplications,
            facultyMembers
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

module.exports = {
    assignWorkload,
    getLeaveApplicationsForAssignment
};