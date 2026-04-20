// Workload Controller
const WorkloadAssignment = require('../models/WorkloadAssignment');
const User = require('../models/User');

// Get workload assignments for a faculty member
exports.getWorkloadAssignments = async (req, res) => {
    try {
        const assignments = await WorkloadAssignment.find({ assignedTo: req.user._id })
            .populate('leaveApplication')
            .populate('assignedBy', 'name email')
            .sort({ assignedAt: -1 });

        res.json({
            success: true,
            data: assignments
        });
    } catch (error) {
        console.error('Error getting workload assignments:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load workload assignments'
        });
    }
};

// Approve a workload assignment
exports.approveWorkload = async (req, res) => {
    try {
        const { id } = req.params;
        
        const assignment = await WorkloadAssignment.findById(id);
        if (!assignment) {
            return res.status(404).json({
                success: false,
                message: 'Assignment not found'
            });
        }

        if (assignment.assignedTo.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'You are not authorized to approve this assignment'
            });
        }

        if (assignment.status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: 'This assignment has already been responded to'
            });
        }

        assignment.status = 'approved';
        assignment.respondedAt = new Date();
        await assignment.save();

        res.json({
            success: true,
            message: 'Workload assignment approved'
        });
    } catch (error) {
        console.error('Error approving workload:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to approve workload assignment'
        });
    }
};

// Reject a workload assignment
exports.rejectWorkload = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        
        const assignment = await WorkloadAssignment.findById(id);
        if (!assignment) {
            return res.status(404).json({
                success: false,
                message: 'Assignment not found'
            });
        }

        if (assignment.assignedTo.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'You are not authorized to reject this assignment'
            });
        }

        if (assignment.status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: 'This assignment has already been responded to'
            });
        }

        assignment.status = 'rejected';
        assignment.rejectionReason = reason;
        assignment.respondedAt = new Date();
        await assignment.save();

        res.json({
            success: true,
            message: 'Workload assignment rejected'
        });
    } catch (error) {
        console.error('Error rejecting workload:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to reject workload assignment'
        });
    }
};
